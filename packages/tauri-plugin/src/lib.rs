use std::sync::Mutex;
use tauri::{
    plugin::{self, TauriPlugin},
    Manager, Runtime, Listener,
};

pub use models::*;

mod desktop;
mod commands;
mod error;
mod models;

pub use error::{Error, Result};

use desktop::Wdio;

struct AppHandleHolder {
    handle: Mutex<Option<Box<dyn std::any::Any + Send + Sync>>>,
}

static APP_HANDLE: AppHandleHolder = AppHandleHolder {
    handle: Mutex::new(None),
};

pub fn set_app_handle<R: Runtime>(app: tauri::AppHandle<R>) {
    let mut guard = APP_HANDLE.handle.lock().unwrap();
    *guard = Some(Box::new(app));
}

struct WdioUnifiedLogger;

static LOGGER_INIT: Mutex<bool> = Mutex::new(false);

impl log::Log for WdioUnifiedLogger {
    fn enabled(&self, _metadata: &log::Metadata) -> bool {
        true
    }

    fn log(&self, record: &log::Record) {
        eprintln!("[Tauri:Backend] {}: {}", record.level(), record.args());
    }

    fn flush(&self) {}
}

/// Listen for frontend-log events and output to stderr
/// Uses app.listen() to catch events emitted from frontend
/// Outputs with [Tauri:Frontend] prefix for unified log parsing
fn setup_frontend_log_listener<R: Runtime>(app: &tauri::AppHandle<R>) {
    eprintln!("[WDIO-Rust] Setting up frontend-log listener");
    let app_handle = app.app_handle().clone();

    // Try app-level listener
    let _ = app_handle.listen("frontend-log", move |event: tauri::Event| {
        eprintln!("[WDIO-Rust] Received frontend-log event on app, payload: {:?}", event.payload());
    });

    // Also try listen_any for cross-window events
    let _ = app_handle.listen_any("frontend-log", move |event: tauri::Event| {
        eprintln!("[WDIO-Rust] Received frontend-log event via listen_any, payload: {:?}", event.payload());
    });

    eprintln!("[WDIO-Rust] frontend-log listeners set up");
}

/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    plugin::Builder::new("wdio")
        .invoke_handler(tauri::generate_handler![commands::execute, commands::log_frontend, commands::debug_plugin])
        .setup(|app_handle, _api| {
            set_app_handle(app_handle.clone());

            // Only set up our global logger if no logger is already configured
            // This prevents conflicts with tauri_plugin_log or other loggers
            let mut initialized = LOGGER_INIT.lock().unwrap();
            if !*initialized {
                let logger = Box::new(WdioUnifiedLogger);
                if let Err(e) = log::set_boxed_logger(logger) {
                    eprintln!("[WDIO] Failed to set global logger (may be already set by another plugin): {}", e);
                } else {
                    *initialized = true;
                }
            }
            drop(initialized);

            // Setup frontend log listener
            setup_frontend_log_listener(app_handle);

            #[cfg(desktop)]
            let wdio = desktop::init(app_handle, _api)?;

            app_handle.manage(wdio);

            Ok(())
        })
        .build()
}

/// Extension trait for accessing wdio APIs
pub trait WdioExt<R: Runtime> {
    fn wdio(&self) -> &Wdio<R>;
}

impl<R: Runtime, T: Manager<R>> WdioExt<R> for T {
    fn wdio(&self) -> &Wdio<R> {
        self.state::<Wdio<R>>().inner()
    }
}
