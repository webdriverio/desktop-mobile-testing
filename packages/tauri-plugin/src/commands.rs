use tauri::{WebviewWindow, command, Runtime, Manager, Listener};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::models::ExecuteRequest;
use crate::Result;

/// Execute JavaScript code in the frontend context
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

    // Generate a unique event ID using UUID
    let event_id = format!("wdio-execute-{}", Uuid::new_v4().to_string());
    log::trace!("Generated event_id: {}", event_id);

    // Set up event listener FIRST to avoid race condition
    let result_tx = tx.clone();
    let error_tx = tx;
    let listener_id = app_handle.listen(&event_id, move |event| {
        log::trace!("Received event payload: {}", event.payload());

        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(success) = payload.get("success").and_then(|s| s.as_bool()) {
                if success {
                    // Success: extract value directly (no double serialization)
                    let value: JsonValue = payload.get("value").unwrap_or(&JsonValue::Null).clone();
                    let _ = result_tx.send(Ok(value));
                } else {
                    // Error: extract error message
                    let error_msg = payload.get("error")
                        .and_then(|e| e.as_str())
                        .unwrap_or("Unknown error")
                        .to_string();
                    let _ = error_tx.send(Err(crate::Error::ExecuteError(error_msg)));
                }
            }
        }
    });

    // Build the script with args injected
    let script = if !request.args.is_empty() {
        let args_json = serde_json::to_string(&request.args)
            .map_err(|e| crate::Error::SerializationError(format!("Failed to serialize args: {}", e)))?;
        format!("(function() {{ const __wdio_args = {}; return ({}); }})()", args_json, request.script)
    } else {
        request.script.clone()
    };

    // Simplified JS wrapper using ONE emit method (window.__TAURI__.event.emit)
    let script_with_return = format!(
        r#"
        (async () => {{
            try {{
                const result = await ({0});
                await window.__TAURI__.event.emit('{1}', {{ success: true, value: result }});
            }} catch (error) {{
                await window.__TAURI__.event.emit('{1}', {{ success: false, error: error.message }});
            }}
        }})();
        "#,
        script, event_id
    );

    // Execute the script
    log::trace!("Executing script via window.eval()");
    window.eval(&script_with_return)
        .map_err(|e| crate::Error::ExecuteError(format!("Failed to eval script: {}", e)))?;

    // Wait for result with 5s timeout
    log::trace!("Waiting for execute result (5s timeout)");

    match rx.recv_timeout(Duration::from_secs(5)) {
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
            log::error!("Timeout waiting for execute result after 5s. Event ID: {}. Window: {}. \
                This usually means the Tauri event system is not working. \
                Check that withGlobalTauri: true in tauri.conf.json", event_id, window_label);
            app_handle.unlisten(listener_id);
            Err(crate::Error::ExecuteError(format!(
                "Script execution timed out after 5s. Event ID: {}. Window: {}",
                event_id, window_label
            )))
        }
    }
}
