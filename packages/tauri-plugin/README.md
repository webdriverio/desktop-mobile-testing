# @wdio/tauri-plugin

A Tauri v2 plugin providing execute and mocking capabilities for WebDriverIO testing. This plugin enables E2E tests to execute JavaScript code in the frontend context with access to Tauri APIs and mock backend commands for isolated testing.

## Features

- ✅ **Execute JavaScript**: Run arbitrary JavaScript code in the frontend context with access to Tauri APIs
- ✅ **Command Mocking**: Intercept and mock Tauri backend commands for testing
- ✅ **Mock Management**: Set, get, clear, reset, and restore mocks
- ✅ **TypeScript Support**: Full TypeScript definitions for the frontend API
- ✅ **Tauri v2 Compatible**: Built for Tauri v2 with proper plugin architecture

## Installation

### 1. Add to Cargo.toml

```toml
[dependencies]
tauri-plugin-wdio = { path = "../../packages/tauri-plugin" }
# or from crates.io when published
# tauri-plugin-wdio = "0.1.0"
```

### 2. Register Plugin in Your App

Add the plugin to your Tauri app's `src-tauri/src/main.rs`:

```rust
use tauri_plugin_wdio::init;

fn main() {
    tauri::Builder::default()
        .plugin(init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. Register Plugin in Build Script

Add the plugin to your app's `src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .plugin(
                "wdio",
                tauri_build::InlinedPlugin::new()
            )
    )
    .expect("failed to run tauri-build");
}
```

### 4. Configure Permissions

The plugin requires permissions to be configured in your app's capability file. Add these permissions to your `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "wdio:allow-execute",
    "wdio:allow-set-mock",
    "wdio:allow-get-mock",
    "wdio:allow-clear-mocks",
    "wdio:allow-reset-mocks",
    "wdio:allow-restore-mocks"
  ]
}
```

### 5. Include Frontend JavaScript

Include the plugin's frontend JavaScript in your app. The plugin exposes `window.wdioTauri` with the following API:

```typescript
// Import the plugin's frontend code
import '@wdio/tauri-plugin/guest-js';

// Or if using a bundler, ensure the guest-js is included in your build
```

## Usage

### Execute JavaScript

The plugin provides an `execute` command that runs JavaScript in the frontend context with access to Tauri APIs:

```typescript
// In your WebDriverIO tests
await browser.execute(() => {
  return window.wdioTauri.execute(
    (tauri) => tauri.core.invoke('get_platform_info'),
    []
  );
});
```

The execute function receives the Tauri APIs object as the first parameter, allowing you to call any Tauri command:

```typescript
await browser.execute(() => {
  return window.wdioTauri.execute(
    async (tauri) => {
      const platform = await tauri.core.invoke('get_platform_info');
      const version = await tauri.core.invoke('get_version');
      return { platform, version };
    },
    []
  );
});
```

### Mocking Commands

Set up mocks for Tauri backend commands:

```typescript
// Set a mock with a return value
await browser.execute(() => {
  return window.wdioTauri.setMock('get_platform_info', {
    return_value: { os: 'mocked', arch: 'x64' }
  });
});

// Execute the command (will return mocked value)
const result = await browser.execute(() => {
  return window.wdioTauri.execute(
    (tauri) => tauri.core.invoke('get_platform_info'),
    []
  );
});
// result === { os: 'mocked', arch: 'x64' }
```

### Mock Management

```typescript
// Get mock configuration
const mock = await browser.execute(() => {
  return window.wdioTauri.getMock('get_platform_info');
});

// Clear all mocks
await browser.execute(() => {
  return window.wdioTauri.clearMocks();
});

// Reset all mocks (clears and removes handlers)
await browser.execute(() => {
  return window.wdioTauri.resetMocks();
});

// Restore all mocks (removes mocks and restores original handlers)
await browser.execute(() => {
  return window.wdioTauri.restoreMocks();
});
```

## API Reference

### Frontend API (`window.wdioTauri`)

#### `execute(script: string, args?: unknown[]): Promise<unknown>`

Execute JavaScript code in the frontend context. The script should be a function that receives the Tauri APIs object as the first parameter.

**Parameters:**
- `script`: JavaScript function string (without the first parameter - it will receive Tauri APIs)
- `args`: Optional array of arguments to pass to the script (after Tauri APIs)

**Returns:** Promise resolving to the script's return value

**Example:**
```typescript
window.wdioTauri.execute(
  '(tauri) => tauri.core.invoke("get_platform_info")',
  []
);
```

#### `setMock(command: string, config: MockConfig): Promise<void>`

Set a mock for a Tauri command.

**Parameters:**
- `command`: Name of the command to mock
- `config`: Mock configuration object
  - `return_value`: Value to return when the command is called
  - `implementation`: Function string to execute instead (not yet implemented)

**Example:**
```typescript
window.wdioTauri.setMock('get_platform_info', {
  return_value: { os: 'mocked', arch: 'x64' }
});
```

#### `getMock(command: string): Promise<MockConfig | null>`

Get the mock configuration for a command.

**Returns:** Mock configuration or `null` if not mocked

#### `clearMocks(): Promise<void>`

Clear all mocks.

#### `resetMocks(): Promise<void>`

Reset all mocks (clears and removes handlers).

#### `restoreMocks(): Promise<void>`

Restore all mocks (removes mocks and restores original handlers).

### Rust API

The plugin provides the following Tauri commands:

- `plugin:wdio|execute` - Execute JavaScript in frontend context
- `plugin:wdio|set-mock` - Set a mock for a command
- `plugin:wdio|get-mock` - Get mock configuration
- `plugin:wdio|clear-mocks` - Clear all mocks
- `plugin:wdio|reset-mocks` - Reset all mocks
- `plugin:wdio|restore-mocks` - Restore all mocks

## Integration with @wdio/tauri-service

The `@wdio/tauri-service` automatically uses this plugin when available. The service's `execute()` method will:

1. Check if `window.wdioTauri` is available
2. Use the plugin's execute API if available
3. Fall back to direct Tauri API calls if the plugin is not available

This means you can use the service's high-level API while benefiting from the plugin's capabilities:

```typescript
import { execute } from '@wdio/tauri-service';

// Service automatically uses the plugin if available
const result = await execute(browser, (tauri) => {
  return tauri.core.invoke('get_platform_info');
});
```

## Configuration

### Permissions

The plugin requires explicit permissions in your Tauri app's capability file. See the [Installation](#4-configure-permissions) section for the required permissions.

### Build Configuration

Ensure your `build.rs` registers the plugin as an `InlinedPlugin`:

```rust
tauri_build::try_build(
    tauri_build::Attributes::new()
        .plugin(
            "wdio",
            tauri_build::InlinedPlugin::new()
        )
)
.expect("failed to run tauri-build");
```

**Important:** Do not pass `.commands()` to `InlinedPlugin::new()` - this causes Tauri to auto-generate invalid permission identifiers. The plugin uses explicit permissions defined in `permissions/default.toml`.

## Troubleshooting

### Plugin Not Available

If `window.wdioTauri` is undefined:

1. Ensure the plugin is registered in `main.rs`
2. Ensure the plugin is registered in `build.rs`
3. Ensure permissions are configured in your capability file
4. Ensure the frontend JavaScript is included in your app
5. Check that `withGlobalTauri` is enabled in `tauri.conf.json`:

```json
{
  "app": {
    "withGlobalTauri": true
  }
}
```

### Permission Errors

If you get permission errors:

1. Verify your capability file includes all required permissions
2. Ensure the capability file is referenced correctly in `tauri.conf.json`:
   ```json
   {
     "app": {
       "security": {
         "capabilities": ["default"]
       }
     }
   }
   ```
3. Clean and rebuild: `cargo clean && pnpm build`

### Execute Timeout

If execute commands timeout:

1. Check that the script is valid JavaScript
2. Ensure `window.__TAURI__` is available
3. Verify the script doesn't have infinite loops
4. Check browser console for errors

## Examples

See the test fixtures in `fixtures/e2e-apps/tauri/` for complete examples of:

- Plugin registration
- Permission configuration
- Frontend integration
- Test usage

## License

MIT OR Apache-2.0

