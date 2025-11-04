use tauri::{AppHandle, WebviewWindow, command, Runtime, Manager, Listener};
use std::sync::{Arc, Mutex};
use serde_json::Value as JsonValue;

use crate::models::{ExecuteRequest, MockConfig};
use crate::Result;
use crate::mock_store::MockStore;

/// Execute JavaScript code in the frontend context
#[command(rename = "wdio.execute")]
pub(crate) async fn wdio_execute<R: Runtime>(
    window: WebviewWindow<R>,
    request: ExecuteRequest,
) -> Result<JsonValue> {
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
        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(result) = payload.get("result") {
                let _ = result_tx.send(Ok(result.clone()));
            } else if let Some(error) = payload.get("error") {
                let _ = error_tx.send(Err(crate::Error::ExecuteError(
                    error.as_str().unwrap_or("Unknown error").to_string()
                )));
            }
        }
    });
    
    // Wrap the script to emit result via event
    // According to Tauri v2 docs: https://v2.tauri.app/develop/calling-frontend/#event-system
    // Events can be emitted using window.__TAURI__.event.emit() when withGlobalTauri is enabled
    let script_with_return = format!(
        r#"
        (async () => {{
            try {{
                const result = {};
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
#[command(rename = "wdio.set-mock")]
pub(crate) async fn wdio_set_mock<R: Runtime>(
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
#[command(rename = "wdio.get-mock")]
pub(crate) async fn wdio_get_mock<R: Runtime>(
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
#[command(rename = "wdio.clear-mocks")]
pub(crate) async fn wdio_clear_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
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
#[command(rename = "wdio.reset-mocks")]
pub(crate) async fn wdio_reset_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
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
#[command(rename = "wdio.restore-mocks")]
pub(crate) async fn wdio_restore_mocks<R: Runtime>(app: AppHandle<R>) -> Result<()> {
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

