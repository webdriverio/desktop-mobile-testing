// WebDriverIO Tauri Plugin Build Configuration
//
// This plugin provides execute and mocking capabilities for WebDriverIO testing.
//
// IMPORTANT: ACL Permissions Setup
// ================================
// This plugin uses tauri_plugin::Builder (not tauri_build::InlinedPlugin) because:
//
// 1. InlinedPlugin does not automatically generate ACL permissions for plugins
// 2. The permissions must be explicitly defined in permissions/default.toml
// 3. Using tauri_plugin::Builder properly integrates the permissions system
// 4. This ensures permissions appear in the generated ACL manifest (gen/schemas/acl-manifests.json)
//
// The permissions/default.toml file defines:
// - default: The default permission set for the plugin
// - allow-*: Individual permissions for each command
//
// Apps using this plugin must include these permissions in their capabilities files:
// - wdio:allow-execute
// - wdio:allow-set-mock
// - wdio:allow-get-mock
// - wdio:allow-clear-mocks
// - wdio:allow-reset-mocks
// - wdio:allow-restore-mocks
//
// For more details on Tauri v2 plugin permissions, see:
// https://v2.tauri.app/develop/plugins/develop/#permissions

const COMMANDS: &[&str] = &[
    "execute",
    "set_mock",
    "get_mock",
    "clear_mocks",
    "reset_mocks",
    "restore_mocks",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}

