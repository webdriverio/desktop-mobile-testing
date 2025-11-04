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
pub trait WdioExt<R: Runtime + Send + Sync> {
    fn wdio(&self) -> &Wdio<R>;
}

impl<R: Runtime + Send + Sync, T: Manager<R>> crate::WdioExt<R> for T {
    fn wdio(&self) -> &Wdio<R> {
        self.state::<Wdio<R>>().inner()
    }
}

/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime + Send + Sync>() -> TauriPlugin<R> {
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
            Ok(())
        })
        .build()
}

