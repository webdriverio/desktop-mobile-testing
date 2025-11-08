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


/// Creates the Wdio plugin with default options.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("wdio")
        .invoke_handler(tauri::generate_handler![
            commands::execute,
            commands::set_mock,
            commands::get_mock,
            commands::clear_mocks,
            commands::reset_mocks,
            commands::restore_mocks,
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

