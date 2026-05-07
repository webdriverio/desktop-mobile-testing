use std::sync::Arc;

use axum::extract::State;
use axum::http::{header::CONTENT_TYPE, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use tauri::Runtime;

use crate::server::AppState;
use crate::webdriver::Timeouts;

#[derive(Deserialize)]
pub struct NativeScreenshotRequest {
    pub window_label: Option<String>,
}

pub async fn capture<R: Runtime + 'static>(
    State(state): State<Arc<AppState<R>>>,
    Json(req): Json<NativeScreenshotRequest>,
) -> Response {
    let label = req.window_label.as_deref().unwrap_or("main");
    let timeouts = Timeouts::default();

    let executor = match state.get_executor_for_window(label, timeouts, Vec::new()) {
        Ok(e) => e,
        Err(e) => {
            let available = state.get_window_labels().join(", ");
            tracing::warn!("Native screenshot: window '{label}' not found: {}", e.message);
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": format!("Window '{label}' not found. Available: [{available}]")
                })),
            )
                .into_response();
        }
    };

    match executor.take_native_screenshot().await {
        Ok(bytes) => ([(CONTENT_TYPE, "image/png")], bytes).into_response(),
        Err(e) => e.into_response(),
    }
}
