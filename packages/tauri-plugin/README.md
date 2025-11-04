# @wdio/tauri-plugin

A Tauri plugin providing execute and mocking capabilities for WebDriverIO testing.

## Features

- **Execute**: Run arbitrary JavaScript code in the frontend context with access to Tauri APIs
- **Mocking**: Intercept and mock Tauri command calls for testing

## Installation

### Cargo.toml

```toml
[dependencies]
tauri-plugin-wdio = { path = "../../packages/tauri-plugin" }
# or from crates.io when published
# tauri-plugin-wdio = "0.1.0"
```

### Register Plugin

```rust
use tauri_plugin_wdio::init;

fn main() {
    tauri::Builder::default()
        .plugin(init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Usage

### Execute

The plugin provides a `wdio.execute` command that executes JavaScript code in the frontend context:

```javascript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('wdio:execute', {
  script: 'window.__TAURI__.core.invoke("get_platform_info")',
  args: []
});
```

### Mocking

Set up mocks for Tauri commands:

```javascript
await invoke('wdio:set-mock', {
  command: 'get_platform_info',
  config: {
    return_value: { os: 'mocked', arch: 'x64' }
  }
});
```

## License

MIT OR Apache-2.0

