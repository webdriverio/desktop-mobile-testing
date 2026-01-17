use tauri::{WebviewWindow, command, Runtime, Manager, Listener};
use serde_json::Value as JsonValue;

use crate::models::ExecuteRequest;
use crate::Result;

/// Execute JavaScript code in the frontend context
#[command]
pub(crate) async fn execute<R: Runtime>(
    window: WebviewWindow<R>,
    request: ExecuteRequest,
) -> Result<JsonValue> {
    log::error!("[WDIO Plugin] ========== EXECUTE COMMAND CALLED ==========");
    log::error!("[WDIO Plugin] Execute request - script length: {} chars", request.script.len());
    log::error!("[WDIO Plugin] Execute request - script preview: {}", &request.script[..std::cmp::min(200, request.script.len())]);
    log::error!("[WDIO Plugin] Execute request - args count: {}", request.args.len());

    // Mock store disabled for JavaScript-only mocking
    // let app = window.app_handle();
    // if let Some(mock_store) = app.try_state::<Arc<Mutex<MockStore>>>() {
    //     if let Ok(store) = mock_store.lock() {
    //         let all_mocks = store.get_all_mocks();
    //         log::info!("[WDIO Plugin] Current mock store contains {} mocks: {:?}", all_mocks.len(), all_mocks.keys().collect::<Vec<_>>());
    //     } else {
    //         log::warn!("[WDIO Plugin] Could not lock mock store to check mocks");
    //     }
    // } else {
    //     log::warn!("[WDIO Plugin] Mock store not found in app state during execute");
    // }

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

    log::error!("[WDIO Plugin] Prepared script length: {} chars", script.len());

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
    
    log::error!("[WDIO Plugin] Setting up event listener for: {}", event_id);
    let listener_id = app_handle.listen(&event_id, move |event| {
        log::error!("[WDIO Plugin] ========== EVENT RECEIVED ==========");
        log::error!("[WDIO Plugin] Received event payload: {}", event.payload());
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
        console.log('[WDIO Plugin] SCRIPT EVAL STARTED');
        window.onerror = function(msg, url, line, col, error) {{
            console.error('[WDIO Plugin] Global error:', msg, 'at', url, line, col, error);
        }};
        (async () => {{
            try {{
                console.log('[WDIO Plugin] Starting JavaScript execution');
                console.log('[WDIO Plugin] window available:', typeof window);
                console.log('[WDIO Plugin] window.__TAURI__ available:', typeof window.__TAURI__);
                console.log('[WDIO Plugin] window.__TAURI__?.core available:', typeof window.__TAURI__?.core);
                console.log('[WDIO Plugin] window.__TAURI__?.event available:', typeof window.__TAURI__?.event);

                console.log('[WDIO Plugin] About to execute script');
                const result = await ({});
                console.log('[WDIO Plugin] Script executed successfully, result:', result);
                const jsonResult = JSON.stringify(result);
                console.log('[WDIO Plugin] JSON serialization successful:', jsonResult);

                // Test event emission APIs
                console.log('[WDIO Plugin] Testing event emission APIs...');
                let eventEmitted = false;

                if (window.__TAURI__?.core?.emit) {{
                    console.log('[WDIO Plugin] Attempting window.__TAURI__.core.emit');
                    try {{
                        window.__TAURI__.core.emit('{}', {{ result: jsonResult }});
                        console.log('[WDIO Plugin] window.__TAURI__.core.emit succeeded');
                        eventEmitted = true;
                    }} catch (emitError) {{
                        console.error('[WDIO Plugin] window.__TAURI__.core.emit failed:', emitError);
                    }}
                }}

                if (!eventEmitted && window.__TAURI__?.event?.emit) {{
                    console.log('[WDIO Plugin] Attempting window.__TAURI__.event.emit');
                    try {{
                        window.__TAURI__.event.emit('{}', {{ result: jsonResult }});
                        console.log('[WDIO Plugin] window.__TAURI__.event.emit succeeded');
                        eventEmitted = true;
                    }} catch (emitError) {{
                        console.error('[WDIO Plugin] window.__TAURI__.event.emit failed:', emitError);
                    }}
                }}

                if (!eventEmitted) {{
                    console.log('[WDIO Plugin] Attempting fallback @tauri-apps/api/event');
                    try {{
                        const {{ emit }} = await import('@tauri-apps/api/event');
                        console.log('[WDIO Plugin] Imported @tauri-apps/api/event successfully');
                        await emit('{}', {{ result: jsonResult }});
                        console.log('[WDIO Plugin] @tauri-apps/api/event emit succeeded');
                        eventEmitted = true;
                    }} catch (emitError) {{
                        console.error('[WDIO Plugin] @tauri-apps/api/event failed:', emitError);
                    }}
                }}

                if (eventEmitted) {{
                    console.log('[WDIO Plugin] Event emitted successfully');
                }} else {{
                    console.error('[WDIO Plugin] All event emission methods failed!');
                    throw new Error('All event emission methods failed');
                }}
            }} catch (error) {{
                console.error('[WDIO Plugin] Script execution error:', error);
                console.error('[WDIO Plugin] Error stack:', error.stack);
                const errorMsg = error.message || String(error);

                // Try to emit error event
                let errorEmitted = false;
                if (window.__TAURI__?.core?.emit) {{
                    try {{
                        window.__TAURI__.core.emit('{}', {{ error: errorMsg }});
                        errorEmitted = true;
                    }} catch (e) {{
                        console.error('[WDIO Plugin] Error emission failed:', e);
                    }}
                }}
                if (!errorEmitted && window.__TAURI__?.event?.emit) {{
                    try {{
                        window.__TAURI__.event.emit('{}', {{ error: errorMsg }});
                        errorEmitted = true;
                    }} catch (e) {{
                        console.error('[WDIO Plugin] Error emission failed:', e);
                    }}
                }}
                if (!errorEmitted) {{
                    try {{
                        const {{ emit }} = await import('@tauri-apps/api/event');
                        await emit('{}', {{ error: errorMsg }});
                        errorEmitted = true;
                    }} catch (e) {{
                        console.error('[WDIO Plugin] Error emission failed:', e);
                    }}
                }}
            }}
        }})().catch(function(e) {{
            console.error('[WDIO Plugin] Unhandled Promise rejection:', e);
        }});
        "#,
        script, event_id, event_id, event_id, event_id, event_id, event_id
    );

    // Execute the script
    log::error!("[WDIO Plugin] About to call window.eval() with {} chars", script_with_return.len());
    let eval_result = window.eval(&script_with_return);
    match &eval_result {
        Ok(_) => log::error!("[WDIO Plugin] window.eval() returned Ok"),
        Err(e) => log::error!("[WDIO Plugin] window.eval() returned Err: {}", e),
    }
    eval_result.map_err(|e| crate::Error::ExecuteError(e.to_string()))?;

    // Wait for result with timeout
    log::error!("[WDIO Plugin] Waiting for event result (30s timeout)...");
    match rx.recv_timeout(Duration::from_secs(30)) {
        Ok(Ok(result)) => {
            log::error!("[WDIO Plugin] ========== SUCCESS ==========");
            log::error!("[WDIO Plugin] Got result: {:?}", result);
            app_handle.unlisten(listener_id);
            Ok(result)
        }
        Ok(Err(e)) => {
            log::error!("[WDIO Plugin] ========== ERROR FROM JS ==========");
            log::error!("[WDIO Plugin] Got error: {:?}", e);
            app_handle.unlisten(listener_id);
            Err(e)
        }
        Err(_) => {
            log::error!("[WDIO Plugin] ========== TIMEOUT ==========");
            log::error!("[WDIO Plugin] No event received within 30 seconds!");
            app_handle.unlisten(listener_id);
            Err(crate::Error::ExecuteError("Timeout waiting for execute result".to_string()))
        }
    }
}
