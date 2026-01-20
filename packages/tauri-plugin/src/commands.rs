use tauri::{command, Manager, Runtime, WebviewWindow, Listener, Emitter};
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

    let event_id = format!("wdio-execute-{}", Uuid::new_v4().to_string());
    log::trace!("Generated event_id: {}", event_id);

    let result_tx = tx.clone();
    let error_tx = tx;
    let listener_id = app_handle.listen(&event_id, move |event| {
        log::trace!("Received event payload: {}", event.payload());

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

    let script = if !request.args.is_empty() {
        let args_json = serde_json::to_string(&request.args)
            .map_err(|e| crate::Error::SerializationError(format!("Failed to serialize args: {}", e)))?;
        format!("(function() {{ const __wdio_args = {}; return ({}); }})()", args_json, request.script)
    } else {
        request.script.clone()
    };

    let script_with_return = format!(
        r#"
        (async () {{
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

    log::trace!("Executing script via window.eval()");
    window.eval(&script_with_return)
        .map_err(|e| crate::Error::ExecuteError(format!("Failed to eval script: {}", e)))?;

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

/// Log a message from the frontend - tauri-service adds [Tauri:Frontend] prefix
#[command]
pub(crate) fn log_frontend<R: Runtime>(
    _window: WebviewWindow<R>,
    level: String,
    message: String,
) -> Result<()> {
    match level.as_str() {
        "trace" => log::trace!(target: "frontend", "{}", message),
        "debug" => log::debug!(target: "frontend", "{}", message),
        "info" => log::info!(target: "frontend", "{}", message),
        "warn" => log::warn!(target: "frontend", "{}", message),
        "error" => log::error!(target: "frontend", "{}", message),
        _ => return Err(crate::Error::ExecuteError(format!("Unknown log level: {}", level))),
    }
    Ok(())
}

/// Generate test logs - emits events that frontend listens for and logs to console
/// This bypasses tauri-driver's stdout limitation by routing through frontend console
#[command]
pub(crate) fn generate_test_logs<R: Runtime>(app: tauri::AppHandle<R>) -> Result<()> {
    let logs = [
        ("TRACE", "[Test] This is a TRACE level log"),
        ("DEBUG", "[Test] This is a DEBUG level log"),
        ("INFO", "[Test] This is an INFO level log"),
        ("WARN", "[Test] This is a WARN level log"),
        ("ERROR", "[Test] This is an ERROR level log"),
    ];

    for (_level, message) in logs {
        let log_line = format!("[Tauri:Backend] {}", message);
        if let Err(e) = app.emit("backend-log", &log_line) {
            log::warn!("Failed to emit backend log event: {}", e);
        }
    }

    Ok(())
}
