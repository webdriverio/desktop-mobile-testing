# Getting Started with @wdio/tauri-plugin

This guide will help you set up the `@wdio/tauri-plugin` in your Tauri application for WebDriverIO testing.

## Overview

The `@wdio/tauri-plugin` is a Tauri v2 plugin that provides:

- **Execute API**: Run JavaScript code in the frontend context with access to Tauri APIs
- **Mocking API**: Mock backend commands for isolated testing
- **TypeScript Support**: Full type definitions for the frontend API

## Prerequisites

- Tauri v2 application
- Rust toolchain installed
- Node.js and pnpm (or npm/yarn)
- WebDriverIO test setup

## Installation Steps

### Step 1: Add Plugin Dependency

Add the plugin to your Tauri app's `Cargo.toml`:

```toml
[dependencies]
tauri-plugin-wdio = { path = "../../packages/tauri-plugin" }
# or from crates.io when published
# tauri-plugin-wdio = "0.1.0"
```

### Step 2: Register Plugin in Main

Add the plugin to your `src-tauri/src/main.rs`:

```rust
use tauri_plugin_wdio::init;

fn main() {
    tauri::Builder::default()
        .plugin(init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 3: Register Plugin in Build Script

Add the plugin to your `src-tauri/build.rs`:

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

**Important:** Do not pass `.commands()` to `InlinedPlugin::new()`. The plugin uses explicit permissions defined in `permissions/default.toml`.

### Step 4: Configure Permissions

Add the required permissions to your capability file `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:default",
    "core:event:default",
    "core:path:default",
    "wdio:allow-execute",
    "wdio:allow-set-mock",
    "wdio:allow-get-mock",
    "wdio:allow-clear-mocks",
    "wdio:allow-reset-mocks",
    "wdio:allow-restore-mocks"
  ]
}
```

### Step 5: Reference Capability in Config

Ensure your `tauri.conf.json` references the capability:

```json
{
  "app": {
    "security": {
      "capabilities": ["default"]
    },
    "withGlobalTauri": true
  }
}
```

### Step 6: Include Frontend JavaScript

Include the plugin's frontend JavaScript in your app. If using a bundler (Vite, Webpack, etc.):

```typescript
// In your main frontend file (e.g., main.ts, App.tsx)
import '@wdio/tauri-plugin/guest-js';
```

Or if using plain HTML:

```html
<script type="module">
  import '@wdio/tauri-plugin/guest-js';
</script>
```

## Usage in Tests

### Basic Execute

```typescript
import { expect } from '@wdio/globals';

describe('Tauri App Tests', () => {
  it('should execute Tauri commands', async () => {
    const result = await browser.execute(() => {
      return window.wdioTauri.execute(
        (tauri) => tauri.core.invoke('get_platform_info'),
        []
      );
    });

    expect(result).toHaveProperty('os');
    expect(result).toHaveProperty('arch');
  });
});
```

### Mocking Commands

```typescript
describe('Tauri App Tests with Mocks', () => {
  beforeEach(async () => {
    // Set up mock before each test
    await browser.execute(() => {
      return window.wdioTauri.setMock('get_platform_info', {
        return_value: { os: 'mocked', arch: 'x64' }
      });
    });
  });

  afterEach(async () => {
    // Clear mocks after each test
    await browser.execute(() => {
      return window.wdioTauri.clearMocks();
    });
  });

  it('should use mocked command', async () => {
    const result = await browser.execute(() => {
      return window.wdioTauri.execute(
        (tauri) => tauri.core.invoke('get_platform_info'),
        []
      );
    });

    expect(result).toEqual({ os: 'mocked', arch: 'x64' });
  });
});
```

### Using with @wdio/tauri-service

The `@wdio/tauri-service` automatically uses the plugin when available:

```typescript
import { execute } from '@wdio/tauri-service';

describe('Tauri App Tests', () => {
  it('should use service execute API', async () => {
    // Service automatically uses plugin if available
    const result = await execute(browser, (tauri) => {
      return tauri.core.invoke('get_platform_info');
    });

    expect(result).toHaveProperty('os');
  });
});
```

## API Reference

### `window.wdioTauri.execute(script, args?)`

Execute JavaScript code in the frontend context.

**Parameters:**
- `script`: Function string that receives Tauri APIs as first parameter
- `args`: Optional array of additional arguments

**Returns:** Promise resolving to the script's return value

### `window.wdioTauri.setMock(command, config)`

Set a mock for a Tauri command.

**Parameters:**
- `command`: Command name to mock
- `config`: Mock configuration
  - `return_value`: Value to return when command is called

### `window.wdioTauri.getMock(command)`

Get mock configuration for a command.

**Returns:** Mock configuration or `null`

### `window.wdioTauri.clearMocks()`

Clear all mocks.

### `window.wdioTauri.resetMocks()`

Reset all mocks (clears and removes handlers).

### `window.wdioTauri.restoreMocks()`

Restore all mocks (removes mocks and restores original handlers).

## Troubleshooting

### Plugin Not Available

If `window.wdioTauri` is undefined:

1. ✅ Verify plugin is registered in `main.rs`
2. ✅ Verify plugin is registered in `build.rs`
3. ✅ Check permissions are configured in capability file
4. ✅ Ensure frontend JavaScript is imported
5. ✅ Verify `withGlobalTauri` is enabled in `tauri.conf.json`
6. ✅ Clean and rebuild: `cargo clean && pnpm build`

### Permission Errors

If you get "capability with identifier default not found":

1. ✅ Verify capability file exists at `src-tauri/capabilities/default.json`
2. ✅ Check capability is referenced in `tauri.conf.json`: `"capabilities": ["default"]`
3. ✅ Ensure plugin is registered in `build.rs`
4. ✅ Clean build directory: `rm -rf src-tauri/gen && cargo clean`

### Build Errors

If build fails with permission identifier errors:

1. ✅ Ensure `InlinedPlugin::new()` does NOT have `.commands()` call
2. ✅ Verify `permissions/default.toml` uses valid identifiers (no dots)
3. ✅ Check capability file uses correct format: `wdio:allow-execute` (not `wdio:allow-wdio.execute`)

## Examples

See the test fixtures for complete examples:

- **E2E App**: `fixtures/e2e-apps/tauri/`
- **Package Tests**: `fixtures/package-tests/tauri-app/`
- **E2E Tests**: `e2e/test/tauri/`

## Next Steps

- Read the [Plugin README](../packages/tauri-plugin/README.md) for detailed API documentation
- Check out the [Tauri Service README](../packages/tauri-service/README.md) for service integration
- Explore the [E2E test examples](../../e2e/test/tauri/) for usage patterns

