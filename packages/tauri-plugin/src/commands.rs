use tauri::{command, Manager, Runtime, WebviewWindow, Listener};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::models::ExecuteRequest;
use crate::Result;
use crate::Error;

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
/// It extracts the script from the request, evaluates it, and returns the result via events
#[command]
pub(crate) async fn execute<R: Runtime>(
    window: WebviewWindow<R>,
    request: ExecuteRequest,
) -> Result<JsonValue> {
    log::debug!("Execute command called");
    log::trace!("Script length: {} chars", request.script.len());

    let app_handle = window.app_handle().clone();
    let window_label = window.label().to_owned();

    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel();

    // Generate unique event ID for this execution
    let event_id = format!("wdio-result-{}", Uuid::new_v4());
    log::trace!("Generated event_id for result: {}", event_id);

    let result_tx = tx.clone();
    let error_tx = tx;

    // Listen for the result event from the frontend
    let listener_id = app_handle.listen(&event_id, move |event| {
        log::trace!("Received result event payload: {}", event.payload());

        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(success) = payload.get("success").and_then(|s| s.as_bool()) {
                if success {
                    let value: JsonValue = payload.get("value").unwrap_or(&JsonValue::Null).clone();
                    let _ = result_tx.send(Ok(value));
                } else {
                    let error_msg = payload.get("error")
                        .and_then(|e| e.as_str())
                        .unwrap_or("Unknown error")
                        .to_string();
                    let _ = error_tx.send(Err(crate::Error::ExecuteError(error_msg)));
                }
            }
        }
    });

    // Build the script with args if provided
    let script = if !request.args.is_empty() {
        let args_json = serde_json::to_string(&request.args)
            .map_err(|e| crate::Error::SerializationError(format!("Failed to serialize args: {}", e)))?;
        format!("(function() {{ const __wdio_args = {}; return ({}); }})()", args_json, request.script)
    } else {
        request.script.clone()
    };

    // Wrap the script to:
    // 1. Wait for window.__TAURI__.core.invoke to be available (handles race condition)
    // 2. Execute the user's script
    // 3. Emit the result via a Tauri event (using window.__TAURI__.event if available)
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

                // Execute the user's script
                const result = await ({});

                // Emit the result via event - prefer window.__TAURI__.event if available
                const emit = window.__TAURI__?.event?.emit;
                if (emit) {{
                    await emit('{}', {{ success: true, value: result }});
                }} else {{
                    // Fallback to dynamic import
                    const {{ emit }} = await import('@tauri-apps/api/event');
                    await emit('{}', {{ success: true, value: result }});
                }}
            }} catch (error) {{
                // Emit error via event
                try {{
                    const emit = window.__TAURI__?.event?.emit;
                    if (emit) {{
                        await emit('{}', {{ success: false, error: error.message || String(error) }});
                    }} else {{
                        const {{ emit }} = await import('@tauri-apps/api/event');
                        await emit('{}', {{ success: false, error: error.message || String(error) }});
                    }}
                }} catch (emitError) {{
                    // If emit also fails, log to console as last resort
                    console.error('[WDIO Execute] Failed to emit result:', emitError);
                }}
            }}
        }})();
        "#,
        script, event_id, event_id, event_id, event_id
    );

    log::trace!("Executing script via window.eval()");

    // Evaluate the script
    if let Err(e) = window.eval(&script_with_result) {
        log::error!("Failed to eval script: {}", e);
        app_handle.unlisten(listener_id);
        return Err(crate::Error::ExecuteError(format!("Failed to eval script: {}", e)));
    }

    log::trace!("Waiting for execute result (10s timeout)");

    // Wait for the result event with 10s timeout
    match rx.recv_timeout(Duration::from_secs(10)) {
        Ok(Ok(result)) => {
            log::debug!("Execute completed successfully");
            log::trace!("Result: {:?}", result);
            app_handle.unlisten(listener_id);
            Ok(result)
        }
        Ok(Err(e)) => {
            log::error!("JS error during execution: {}", e);
            app_handle.unlisten(listener_id);
            Err(e)
        }
        Err(_) => {
            log::error!("Timeout waiting for execute result after 10s. Event ID: {}. Window: {}",
                event_id, window_label);
            app_handle.unlisten(listener_id);
            Err(crate::Error::ExecuteError(format!(
                "Script execution timed out after 10s. Event ID: {}. Window: {}",
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
