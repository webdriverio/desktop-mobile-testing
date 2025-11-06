# Tauri Capabilities Configuration

This directory contains capability files that define the ACL (Access Control List) permissions for the application.

## WebDriverIO Plugin Permissions

The following permissions are required for the `@wdio/tauri-plugin` to function during testing:

- `wdio:allow-execute` - Allows executing JavaScript in the frontend with access to Tauri APIs
- `wdio:allow-set-mock` - Allows setting mock configurations for Tauri commands
- `wdio:allow-get-mock` - Allows retrieving mock configurations
- `wdio:allow-clear-mocks` - Allows clearing all mocks
- `wdio:allow-reset-mocks` - Allows resetting mocks to initial state
- `wdio:allow-restore-mocks` - Allows restoring original command handlers

These permissions are defined in the plugin's `permissions/default.toml` file and must be explicitly included in your app's capability files.

## For More Information

- [Tauri v2 Security & Capabilities](https://v2.tauri.app/security/capabilities/)
- [Plugin Permissions Documentation](../../../../packages/tauri-plugin/permissions/default.toml)
