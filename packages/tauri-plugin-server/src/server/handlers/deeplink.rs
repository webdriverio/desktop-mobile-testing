//! Deeplink forwarding endpoint for embedded WebDriver mode.
//!
//! This module provides an HTTP endpoint that allows external processes
//! (like the WDIO test runner) to forward deeplink URLs to the running
//! Tauri application without relying on platform-specific single-instance
//! mechanisms.

use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Runtime};
use tracing::{info, warn};

use crate::server::AppState;
use crate::server::response::WebDriverErrorResponse;

/// Request body for deeplink forwarding.
#[derive(Deserialize)]
pub struct DeeplinkRequest {
    /// The deeplink URL to forward (e.g., "myapp://open?file=test")
    pub url: String,
}

/// Success response for deeplink forwarding.
#[derive(Serialize)]
pub struct DeeplinkResponse {
    /// Whether the deeplink was successfully forwarded
    pub success: bool,
    /// The URL that was forwarded
    pub url: String,
}

/// POST /__wdio/deeplink - Forward deeplink to running instance.
///
/// This endpoint allows external processes to forward deeplink URLs
/// to the running Tauri application. It emits a `deeplink-received`
/// event that the application can listen for.
///
/// # Request
///
/// ```json
/// {
///   "url": "myapp://open?file=test"
/// }
/// ```
///
/// # Response
///
/// On success:
/// ```json
/// {
///   "success": true,
///   "url": "myapp://open?file=test"
/// }
/// ```
///
/// On error, returns a WebDriver-compliant error response.
///
/// # Example
///
/// ```bash
/// curl -X POST http://127.0.0.1:4445/__wdio/deeplink \
///   -H "Content-Type: application/json" \
///   -d '{"url": "myapp://test"}'
/// ```
pub async fn forward<R: Runtime>(
    State(state): State<Arc<AppState<R>>>,
    Json(payload): Json<DeeplinkRequest>,
) -> Result<Json<DeeplinkResponse>, WebDriverErrorResponse> {
    info!("Received deeplink forward request: {}", payload.url);

    // Validate URL is not empty
    if payload.url.is_empty() {
        return Err(WebDriverErrorResponse::invalid_argument(
            "Deeplink URL cannot be empty",
        ));
    }

    // Emit the deeplink-received event to all windows
    match state.app.emit("deeplink-received", &payload.url) {
        Ok(_) => {
            info!(
                "Successfully emitted deeplink-received event for: {}",
                payload.url
            );
            Ok(Json(DeeplinkResponse {
                success: true,
                url: payload.url,
            }))
        }
        Err(e) => {
            warn!("Failed to emit deeplink event: {}", e);
            Err(WebDriverErrorResponse::unknown_error(&format!(
                "Failed to emit deeplink event: {}",
                e
            )))
        }
    }
}
