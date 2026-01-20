use std::sync::Mutex;
use tauri::{
    plugin::{self, TauriPlugin},
    Manager, Runtime, Emitter,
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

struct WdioLogLogger;

impl log::Log for WdioLogLogger {
    fn enabled(&self, _metadata: &log::Metadata) -> bool {
        true
    }

    fn log(&self, record: &log::Record) {
        let line = format!("{}: {}", record.level(), record.args());

        let guard = APP_HANDLE.handle.lock().unwrap();
        if let Some(app_any) = &*guard {
            if let Some(app) = app_any.downcast_ref::<tauri::AppHandle>() {
                // Emit to the main window explicitly
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("backend-log", &line);
                } else {
                    // Fallback to app-level emit
                    let _ = app.emit("backend-log", &line);
                }
            }
        }
    }

    fn flush(&self) {}
}

/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    plugin::Builder::new("wdio")
        .invoke_handler(tauri::generate_handler![
            commands::execute,
            commands::log_frontend,
            commands::generate_test_logs,
        ])
        .setup(|app_handle, _api| {
            set_app_handle(app_handle.clone());

            let logger = Box::new(WdioLogLogger);
            let _ = log::set_boxed_logger(logger);

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
