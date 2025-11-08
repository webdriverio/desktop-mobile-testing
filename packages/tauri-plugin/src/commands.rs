use tauri::{AppHandle, WebviewWindow, command, Runtime, Manager, Listener};
use std::sync::{Arc, Mutex};
use serde_json::Value as JsonValue;

use crate::models::{ExecuteRequest, MockConfig};
use crate::Result;
use crate::mock_store::MockStore;

/// Execute JavaScript code in the frontend context
#[command]
pub(crate) async fn execute<R: Runtime>(
    window: WebviewWindow<R>,
    request: ExecuteRequest,
) -> Result<JsonValue> {
    log::info!("[WDIO Plugin] Execute request - script: {}", request.script);
    log::info!("[WDIO Plugin] Execute request - args: {:?}", request.args);

    // Build the script with args injected
    // The script should be a function that receives args, or a standalone script
    // We'll wrap it to pass args if args are provided
    let script = if !request.args.is_empty() {
        // Serialize args to JSON and inject them into the script
        let args_json = serde_json::to_string(&request.args)
            .map_err(|e| crate::Error::SerializationError(format!("Failed to serialize args: {}", e)))?;

        // Wrap the script to inject args as a variable
        format!("(function() {{ const __wdio_args = {}; return ({}); }})()", args_json, request.script)
    } else {
        request.script
    };

    log::info!("[WDIO Plugin] Prepared script: {}", script);

    // Use WebviewWindow::eval() to execute JavaScript in the frontend context
    // This gives the code access to window.__TAURI__ APIs
    // Note: eval() returns Result<(), Error> - it executes the script but doesn't return the result
    // We need to use a channel to get the result back from the frontend
    use std::sync::mpsc;
    use std::time::Duration;
    
    let (tx, rx) = mpsc::channel();
    // Use timestamp + random number for unique event ID
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let event_id = format!("wdio:execute:{}", timestamp);
    
    // Set up event listener to capture result
    let app_handle = window.app_handle().clone();
    let result_tx = tx.clone();
    let error_tx = tx;
    
    let listener_id = app_handle.listen(&event_id, move |event| {
        log::info!("[WDIO Plugin] Received event payload: {}", event.payload());
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            log::info!("[WDIO Plugin] Parsed payload: {:?}", payload);
            if let Some(result) = payload.get("result") {
                log::info!("[WDIO Plugin] Got result field: {:?}", result);
                // Result is a JSON string that needs to be parsed back to a value
                if let Some(json_str) = result.as_str() {
                    log::info!("[WDIO Plugin] Result is string: {}", json_str);
                    match serde_json::from_str::<serde_json::Value>(json_str) {
                        Ok(parsed) => {
                            log::info!("[WDIO Plugin] Successfully parsed result: {:?}", parsed);
                            let _ = result_tx.send(Ok(parsed));
                        }
                        Err(e) => {
                            log::error!("[WDIO Plugin] Failed to parse result JSON: {}", e);
                            let _ = error_tx.send(Err(crate::Error::ExecuteError(
                                format!("Failed to parse result JSON: {}", e)
                            )));
                        }
                    }
                } else {
                    log::info!("[WDIO Plugin] Result is not a string, using as-is");
                    // If it's not a string, just use it as-is
                    let _ = result_tx.send(Ok(result.clone()));
                }
            } else if let Some(error) = payload.get("error") {
                log::error!("[WDIO Plugin] Got error field: {:?}", error);
                let _ = error_tx.send(Err(crate::Error::ExecuteError(
                    error.as_str().unwrap_or("Unknown error").to_string()
                )));
            } else {
                log::warn!("[WDIO Plugin] Payload has neither result nor error field!");
            }
        } else {
            log::error!("[WDIO Plugin] Failed to parse event payload as JSON");
        }
    });
    
    // Wrap the script to emit result via event
    // According to Tauri v2 docs: https://v2.tauri.app/develop/calling-frontend/#event-system
    // Events can be emitted using window.__TAURI__.event.emit() when withGlobalTauri is enabled
    let script_with_return = format!(
        r#"
        (async () => {{
            try {{
                const result = await ({});
                const jsonResult = JSON.stringify(result);
                // Use Tauri event API to send result back to Rust
                if (window.__TAURI__?.event?.emit) {{
                    window.__TAURI__.event.emit('{}', {{ result: jsonResult }});
                }} else {{
                    // Fallback: try importing from @tauri-apps/api/event
                    const {{ emit }} = await import('@tauri-apps/api/event');
                    emit('{}', {{ result: jsonResult }});
                }}
            }} catch (error) {{
                const errorMsg = error.message || String(error);
                if (window.__TAURI__?.event?.emit) {{
                    window.__TAURI__.event.emit('{}', {{ error: errorMsg }});
                }} else {{
                    const {{ emit }} = await import('@tauri-apps/api/event');
                    emit('{}', {{ error: errorMsg }});
                }}
            }}
        }})()
        "#,
        script, event_id, event_id, event_id, event_id
    );

    // Execute the script
    window
        .eval(&script_with_return)
        .map_err(|e| crate::Error::ExecuteError(e.to_string()))?;

    // Wait for result with timeout
    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(Ok(result)) => {
            app_handle.unlisten(listener_id);
            Ok(result)
        }
        Ok(Err(e)) => {
            app_handle.unlisten(listener_id);
            Err(e)
        }
        Err(_) => {
            app_handle.unlisten(listener_id);
            Err(crate::Error::ExecuteError("Timeout waiting for execute result".to_string()))
        }
    }
}

/// Set a mock for a Tauri command
#[command]
pub(crate) async fn set_mock<R: Runtime>(
    app: AppHandle<R>,
    command: String,
    config: MockConfig,
) -> Result<()> {
    let mock_store = app
        .try_state::<Arc<Mutex<MockStore>>>()
        .ok_or_else(|| crate::Error::MockError("Mock store not found".to_string()))?;

    let mut store = mock_store
        .lock()
        .map_err(|e| crate::Error::MockError(format!("Failed to lock mock store: {}", e)))?;

    store.set_mock(command, config);
    Ok(())
}

/// Get a mock configuration for a command
#[command]
pub(crate) async fn get_mock<R: Runtime>(
    app: AppHandle<R>,
    command: String,
) -> Result<Option<MockConfig>> {
    let mock_store = app
        .try_state::<Arc<Mutex<MockStore>>>()
        .ok_or_else(|| crate::Error::MockError("Mock store not found".to_string()))?;

    let store = mock_store
        .lock()
        .map_err(|e| crate::Error::MockError(format!("Failed to lock mock store: {}", e)))?;

    Ok(store.get_mock(&command).cloned())
}

/// Clear all mocks
#[command]
pub(crate) async fn clear_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let mock_store = app
        .try_state::<Arc<Mutex<MockStore>>>()
        .ok_or_else(|| crate::Error::MockError("Mock store not found".to_string()))?;

    let mut store = mock_store
        .lock()
        .map_err(|e| crate::Error::MockError(format!("Failed to lock mock store: {}", e)))?;

    store.clear_mocks();
    Ok(())
}

/// Reset all mocks (clear and remove original handlers)
#[command]
pub(crate) async fn reset_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let mock_store = app
        .try_state::<Arc<Mutex<MockStore>>>()
        .ok_or_else(|| crate::Error::MockError("Mock store not found".to_string()))?;

    let mut store = mock_store
        .lock()
        .map_err(|e| crate::Error::MockError(format!("Failed to lock mock store: {}", e)))?;

    store.reset_mocks();
    Ok(())
}

/// Restore all mocks (remove mocks and restore original handlers)
#[command]
pub(crate) async fn restore_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let mock_store = app
        .try_state::<Arc<Mutex<MockStore>>>()
        .ok_or_else(|| crate::Error::MockError("Mock store not found".to_string()))?;

    let mut store = mock_store
        .lock()
        .map_err(|e| crate::Error::MockError(format!("Failed to lock mock store: {}", e)))?;

    // For now, same as reset - restore functionality will be enhanced when we implement
    // original handler storage
    store.reset_mocks();
    Ok(())
}

