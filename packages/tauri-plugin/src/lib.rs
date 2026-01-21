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
fn setup_frontend_log_listener<R: Runtime>(app: &tauri::AppHandle<R>) {
    let listener_id = app.listen("frontend-log", move |event| {
        eprintln!("[Tauri:Frontend] {}", event.payload());
    });
    // Store listener_id to prevent it from being dropped (we want it for the lifetime of the app)
    let _ = listener_id;
}

/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    plugin::Builder::new("wdio")
        .invoke_handler(tauri::generate_handler![commands::execute])
        .setup(|app_handle, _api| {
            set_app_handle(app_handle.clone());

            let logger = Box::new(WdioUnifiedLogger);
            let _ = log::set_boxed_logger(logger);

            // Setup frontend log listener
            setup_frontend_log_listener(&app_handle);

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
