use tauri::{command, Manager, Runtime, WebviewWindow, Listener};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::models::ExecuteRequest;
use crate::Result;
use crate::Error;

/// Window state information for generic window management
/// Mirrors Electron's window tracking - discover active window without app-specific knowledge
#[derive(serde::Serialize, Debug, Clone)]
pub struct WindowState {
  pub label: String,
  pub title: String,
  pub is_visible: bool,
  pub is_focused: bool,
}

/// Debug command to verify plugin is working
#[command]
pub(crate) async fn debug_plugin<R: Runtime>(_window: WebviewWindow<R>) -> String {
    eprintln!("[WDIO-Rust] DEBUG PLUGIN CALLED!");
    "Plugin alive".to_string()
}

/// Log a frontend message to stderr (for standalone mode capture)
/// This bypasses the event system and writes directly to stderr
#[command]
pub(crate) async fn log_frontend<R: Runtime>(
    _window: WebviewWindow<R>,
    message: String,
    level: String,
) -> Result<String> {
    // Output with a special marker that the log parser recognizes as frontend
    // Format: [WDIO-FRONTEND][LEVEL] message
    eprintln!("[WDIO-FRONTEND][{}] {}", level.to_uppercase(), message);

    // Return success indicator
    Ok(format!("logged: {} @ {}", level, message))
}

/// Execute JavaScript code in the frontend context
/// This command is called via invoke from the frontend plugin
/// It extracts the script from the request, evaluates it, and returns the result
#[command]
pub(crate) async fn execute<R: Runtime>(
    app: tauri::AppHandle<R>,
    window: WebviewWindow<R>,
    request: ExecuteRequest,
) -> Result<JsonValue> {
    log::debug!("Execute command called");
    log::trace!("Script length: {} chars", request.script.len());

    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    // Use tokio's async oneshot channel for async waiting
    // Wrap sender in Arc<Mutex<Option>> so the Fn closure can take it once
    let (tx, rx) = tokio::sync::oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));

    // Build the script with args if offered
    // For args: inject Tauri APIs as first param, then pass user args
    // For no-args: preserve the script expression and evaluate it below
    let script = if !request.args.is_empty() {
        let args_json = serde_json::to_string(&request.args)
            .map_err(|e| crate::Error::SerializationError(format!("Failed to serialize args: {}", e)))?;
        format!(
            "(function() {{ const __wdio_fn = ({}); const __wdio_args = {}; return __wdio_fn({{ core: window.__TAURI__?.core, event: window.__TAURI__?.event, log: window.__TAURI__?.log }}, ...__wdio_args); }})()",
            request.script, args_json
        )
    } else {
        // No args - preserve the script expression and evaluate it below
        request.script.clone()
    };

    // Generate unique event ID for this execution
    let event_id = format!("wdio-result-{}", Uuid::new_v4());
    log::trace!("Generated event_id for result: {}", event_id);

    // Listen for the result event using the app's event listener
    // The JavaScript uses window.__TAURI__.event.emit() which emits to the APP target
    // So we need to listen on the app target, not the window target
    let tx_clone = Arc::clone(&tx);
    let listener_id = app.listen(&event_id, move |event| {
        log::trace!("Received result event payload: {}", event.payload());

        // Take the sender from the Option (only the first call will succeed)
        let tx = match tx_clone.lock().ok().and_then(|mut guard| guard.take()) {
            Some(tx) => tx,
            None => {
                log::warn!("Event received but sender already taken, ignoring");
                return;
            }
        };

        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(success) = payload.get("success").and_then(|s| s.as_bool()) {
                if success {
                    let value: JsonValue = payload.get("value").unwrap_or(&JsonValue::Null).clone();
                    let _ = tx.send(Ok(value));
                } else {
                    let error_msg = payload.get("error")
                        .and_then(|e| e.as_str())
                        .unwrap_or("Unknown error")
                        .to_string();
                    let _ = tx.send(Err(crate::Error::ExecuteError(error_msg)));
                }
            }
        }
    });

    // Wrap the script to:
    // 1. Wait for window.__TAURI__.core.invoke to be available (handles race condition)
    // 2. Execute the user's script
    // 3. Emit the result via a Tauri event using the current window's emit
    let script_with_result = format!(
        r#"
        (async () => {{
            try {{
                // Wait for window.__TAURI__.core.invoke to be available
                const maxWait = 5000;
                const startTime = Date.now();
                while (!window.__TAURI__?.core?.invoke && (Date.now() - startTime) < maxWait) {{
                    await new Promise(r => setTimeout(r, 10));
                }}
                if (!window.__TAURI__?.core?.invoke) {{
                    throw new Error('window.__TAURI__.core.invoke not available after timeout');
                }}

                // Execute the user's script.
                // If expression resolves to a function, call it with Tauri APIs.
                // Otherwise, await the value directly.
                const __wdio_script = ({});
                const result = typeof __wdio_script === 'function'
                    ? await __wdio_script({{ core: window.__TAURI__?.core, event: window.__TAURI__?.event }})
                    : await __wdio_script;

                // Emit the result using the current window's event emitter
                // This ensures the event goes to the same window where we're listening
                if (window.__TAURI__?.event?.emit) {{
                    await window.__TAURI__.event.emit('{}', {{ success: true, value: result }});
                }} else {{
                    // Fallback: try dynamic import
                    try {{
                        const {{ emit }} = await import('@tauri-apps/api/event');
                        await emit('{}', {{ success: true, value: result }});
                    }} catch (importError) {{
                        console.error('[WDIO Execute] Failed to import emit:', importError);
                        // Last resort: try to use the globalTauri emit
                        if (typeof window.__TAURI__ !== 'undefined') {{
                            const {{ emit }} = await import('@tauri-apps/api/event');
                            await emit('{}', {{ success: true, value: result }});
                        }}
                    }}
                }}
            }} catch (error) {{
                // Emit error via event
                try {{
                    if (window.__TAURI__?.event?.emit) {{
                        await window.__TAURI__.event.emit('{}', {{ success: false, error: error.message || String(error) }});
                    }} else {{
                        const {{ emit }} = await import('@tauri-apps/api/event');
                        await emit('{}', {{ success: false, error: error.message || String(error) }});
                    }}
                }} catch (emitError) {{
                    console.error('[WDIO Execute] Failed to emit error:', emitError);
                }}
            }}
        }})();
        "#,
        script, event_id, event_id, event_id, event_id, event_id
    );

    log::trace!("Executing script via window.eval()");

    // Evaluate the script
    if let Err(e) = window.eval(&script_with_result) {
        log::error!("Failed to eval script: {}", e);
        app.unlisten(listener_id);
        return Err(crate::Error::ExecuteError(format!("Failed to eval script: {}", e)));
    }

    log::trace!("Waiting for execute result (30s timeout)");

    // Wait for the result event with 30s timeout using async
    // This allows the async runtime to process other tasks (like IPC) while waiting
    // This matches the WebDriver default script timeout
    let window_label = window.label().to_owned();
    let timeout_duration = Duration::from_secs(30);
    
    match tokio::time::timeout(timeout_duration, rx).await {
        Ok(Ok(Ok(result))) => {
            log::debug!("Execute completed successfully");
            log::trace!("Result: {:?}", result);
            app.unlisten(listener_id);
            Ok(result)
        }
        Ok(Ok(Err(e))) => {
            log::error!("JS error during execution: {}", e);
            app.unlisten(listener_id);
            Err(e)
        }
        Ok(Err(_)) => {
            // Channel closed without sending (shouldn't happen)
            log::error!("Channel closed unexpectedly. Event ID: {}. Window: {}", event_id, window_label);
            app.unlisten(listener_id);
            Err(crate::Error::ExecuteError(format!(
                "Channel closed unexpectedly. Event ID: {}. Window: {}",
                event_id, window_label
            )))
        }
        Err(_) => {
            log::error!("Timeout waiting for execute result after 30s. Event ID: {}. Window: {}",
                event_id, window_label);
            app.unlisten(listener_id);
            Err(crate::Error::ExecuteError(format!(
                "Script execution timed out after 30s. Event ID: {}. Window: {}",
                event_id, window_label
            )))
        }
    }
}

/// Get the label of the currently focused/active window
/// Note: Tauri 2.x doesn't expose window focus state, so this returns
/// the "main" window if it exists, or the first window in lexicographic order
#[command]
pub(crate) async fn get_active_window_label<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<String> {
  let windows = app.webview_windows();
  if windows.is_empty() {
    return Err(Error::WindowError("No windows available".to_string()));
  }
  // Return the "main" window if it exists for predictable behavior
  if let Some(main) = windows.get("main") {
    return Ok(main.label().to_string());
  }
  // Otherwise, return the first window in lexicographic order for consistency
  let mut labels: Vec<_> = windows.keys().collect();
  labels.sort();
  let first_label = labels.first()
    .ok_or_else(|| Error::WindowError("No windows available".to_string()))?;
  Ok(first_label.to_string())
}

/// List all window labels in the application
#[command]
pub(crate) async fn list_windows<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<Vec<String>> {
  Ok(app.webview_windows().keys().cloned().collect())
}

/// Get detailed state of all windows (for generic window management like Electron)
#[command]
pub(crate) async fn get_window_states<R: Runtime>(
  app: tauri::AppHandle<R>,
) -> Result<Vec<WindowState>> {
  let mut states = Vec::new();
  
  for (label, window) in app.webview_windows() {
    let state = WindowState {
      label: label.clone(),
      title: window.title().unwrap_or_default(),
      is_visible: window.is_visible().unwrap_or(false),
      is_focused: window.is_focused().unwrap_or(false),
    };
    log::debug!("[get_window_states] {}: title='{}', visible={}, focused={}", 
      label, state.title, state.is_visible, state.is_focused);
    states.push(state);
  }
  
  Ok(states)
}
