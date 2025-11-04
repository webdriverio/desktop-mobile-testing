use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

pub fn init<R: Runtime + Send + Sync, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<Wdio<R>> {
    Ok(Wdio {
        _phantom: std::marker::PhantomData,
    })
}

/// Access to the wdio APIs.
pub struct Wdio<R: Runtime + Send + Sync> {
    _phantom: std::marker::PhantomData<R>,
}

impl<R: Runtime + Send + Sync> Wdio<R> {
    // Add mobile-specific methods here
}

