use std::sync::{Arc, Mutex};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;
mod mock_store;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::Wdio;
#[cfg(mobile)]
use mobile::Wdio;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the wdio APIs.
pub trait WdioExt<R: Runtime> {
    fn wdio(&self) -> &Wdio<R>;
}

impl<R: Runtime, T: Manager<R>> crate::WdioExt<R> for T {
    fn wdio(&self) -> &Wdio<R> {
        self.state::<Wdio<R>>().inner()
    }
}

/// Inject frontend JavaScript into all windows
fn inject_frontend_js<R: Runtime>(app: &tauri::AppHandle<R>) -> crate::Result<()> {
    // Embed the execute.js content
    const EXECUTE_JS: &str = include_str!("../gen/execute.js");

    // Inject into all existing windows
    let windows = app.webview_windows();
    for (_, window) in windows.iter() {
        inject_into_window(window, EXECUTE_JS);
    }

    // Inject into new windows when they're created
    // We'll use a window ready callback to inject when the window is ready
    let app_handle = app.clone();
    let execute_js = EXECUTE_JS.to_string();
    
    // Use a simple polling approach for new windows (inject on window ready)
    // This is simpler than event listeners and works reliably
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let windows = app_handle.webview_windows();
            for (_, window) in windows.iter() {
                // Try to inject - the JS is idempotent so it's safe to call multiple times
                inject_into_window(window, &execute_js);
            }
        }
    });

    Ok(())
}

/// Helper function to inject JavaScript into a window
fn inject_into_window<R: Runtime>(window: &tauri::WebviewWindow<R>, js: &str) {
    // Use eval with a small delay to ensure window is ready
    // The execute.js IIFE is idempotent (safe to run multiple times)
    if let Err(e) = window.eval(js) {
        // Only log if it's not a "window not ready" error
        if !e.to_string().contains("not ready") {
            log::debug!("Failed to inject frontend JS into window {}: {}", window.label(), e);
        }
    }
}

/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("wdio")
        .invoke_handler(tauri::generate_handler![
            commands::wdio_execute,
            commands::wdio_set_mock,
            commands::wdio_get_mock,
            commands::wdio_clear_mocks,
            commands::wdio_reset_mocks,
            commands::wdio_restore_mocks,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let wdio = mobile::init(app, api)?;
            #[cfg(desktop)]
            let wdio = desktop::init(app, api)?;

            // Initialize mock store
            let mock_store = Arc::new(Mutex::new(mock_store::MockStore::new()));
            app.manage(mock_store);
            app.manage(wdio);

            // Inject frontend JavaScript into all windows
            inject_frontend_js(app)?;

            Ok(())
        })
        .build()
}

