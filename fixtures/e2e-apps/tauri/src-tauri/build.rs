fn main() {
    // CRITICAL: Register the wdio plugin as an InlinedPlugin in the app's build script
    // This is required for Tauri to discover and merge the plugin's permissions into the ACL manifest
    // Without this, permissions from the plugin's build output will not be included in the final ACL manifest
    // The commands list must match what's registered in the plugin's build.rs
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .plugin(
                "wdio",
                tauri_build::InlinedPlugin::new()
                    .commands(&[
                        "wdio.execute",
                        "wdio.set-mock",
                        "wdio.get-mock",
                        "wdio.clear-mocks",
                        "wdio.reset-mocks",
                        "wdio.restore-mocks",
                    ])
            )
    )
    .unwrap_or_else(|_| {
        println!("cargo:warning=Failed to build with tauri.conf.json, skipping config verification");
    });
}
