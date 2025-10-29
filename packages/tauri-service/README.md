# @wdio/tauri-service

WebDriverIO service for testing Tauri applications with advanced desktop automation capabilities.

## Features

- ✅ **WebDriver Integration** - Full WebDriver protocol support via tauri-driver
- ✅ **Window Management** - Get/set window bounds, maximize, minimize
- ✅ **Screenshot Capture** - High-quality screenshots with format options
- ✅ **File Operations** - Read/write files with encoding support
- ✅ **Process Management** - Launch apps, get process info, kill processes
- ✅ **Clipboard Access** - Read/write system clipboard
- ✅ **Platform Information** - Get OS, architecture, memory, disk space
- ⚠️ **Platform Support** - Windows and Linux only (macOS not supported)

## Installation

```bash
npm install @wdio/tauri-service
# or
pnpm add @wdio/tauri-service
```

## Prerequisites

### Required Software

1. **Tauri CLI** - Install the Tauri CLI:
   ```bash
   npm install -g @tauri-apps/cli
   # or
   cargo install tauri-cli
   ```

2. **tauri-driver** - Install the Tauri WebDriver:
   ```bash
   cargo install tauri-driver
   ```

3. **Platform-specific WebDriver**:
   - **Windows**: Microsoft Edge WebDriver (msedgedriver)
   - **Linux**: WebKitWebDriver (webkit2gtk-driver)

### Platform Support

| Platform | Supported | WebDriver | Notes |
|-----------|------------|-----------|-------|
| Windows | ✅ | Edge WebDriver | Stable and tested |
| Linux | ✅ | WebKitWebDriver | Requires webkit2gtk-driver |
| macOS | ❌ | None | No WKWebView driver support |

## Configuration

### WebDriverIO Configuration

```typescript
// wdio.conf.ts
import { defineConfig } from '@wdio/cli';

export const config = defineConfig({
  runner: 'local',
  specs: ['./test/**/*.spec.ts'],
  capabilities: [
    {
      platformName: 'Windows', // or 'Linux'
      automationName: 'TauriDriver',
      'tauri:app': './path/to/your/tauri-app.exe',
      'tauri:options': {
        commandTimeout: 30000,
        debug: true
      }
    }
  ],
  services: [
    ['@wdio/tauri-service', {
      commandTimeout: 30000,
      debug: true
    }]
  ],
  framework: 'mocha',
  reporters: ['spec']
});
```

### Tauri Application Setup

Your Tauri application needs to expose the required commands. Add these to your `src-tauri/src/main.rs`:

```rust
use tauri::{command, Manager, Window};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct WindowBounds {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[command]
fn get_window_bounds(window: Window) -> Result<WindowBounds, String> {
    let bounds = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    Ok(WindowBounds {
        x: bounds.x,
        y: bounds.y,
        width: size.width,
        height: size.height,
    })
}

#[command]
fn set_window_bounds(window: Window, bounds: WindowBounds) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: bounds.x,
            y: bounds.y,
        }))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: bounds.width,
            height: bounds.height,
        }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Add more commands as needed...

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_window_bounds,
            set_window_bounds,
            // ... other commands
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Usage

### Basic Usage

```typescript
import { TauriService, TauriCommands } from '@wdio/tauri-service';

describe('Tauri App Tests', () => {
  let tauriCommands: TauriCommands;

  before(async () => {
    const tauriService = browser.getService('@wdio/tauri-service');
    tauriCommands = tauriService.getCommands();
  });

  it('should interact with the app', async () => {
    // Standard WebDriver commands
    const button = await $('[data-testid="my-button"]');
    await button.click();

    const input = await $('#my-input');
    await input.setValue('Hello Tauri!');
  });

  it('should manage window', async () => {
    // Get current window bounds
    const bounds = await tauriCommands.getWindowBounds();
    console.log('Window bounds:', bounds);

    // Set new window bounds
    await tauriCommands.setWindowBounds({
      x: 100,
      y: 100,
      width: 800,
      height: 600
    });
  });

  it('should capture screenshot', async () => {
    const screenshot = await tauriCommands.captureScreenshot({
      format: 'png',
      fullPage: true
    });

    // Save screenshot
    require('fs').writeFileSync('screenshot.png', screenshot);
  });
});
```

### Advanced Features

```typescript
describe('Advanced Tauri Features', () => {
  it('should handle file operations', async () => {
    // Write file
    await tauriCommands.writeFile('/tmp/test.txt', 'Hello Tauri!');

    // Read file
    const content = await tauriCommands.readFile('/tmp/test.txt');
    expect(content).toBe('Hello Tauri!');
  });

  it('should get system information', async () => {
    const processInfo = await tauriCommands.getProcessInfo();
    console.log('Process ID:', processInfo.pid);
    console.log('Memory usage:', processInfo.memoryUsage);

    const platformInfo = await tauriCommands.getPlatformInfo();
    console.log('OS:', platformInfo.os);
    console.log('Architecture:', platformInfo.arch);
  });

  it('should handle clipboard', async () => {
    // Set clipboard content
    await tauriCommands.setClipboard('Hello from Tauri!');

    // Get clipboard content
    const content = await tauriCommands.getClipboard();
    expect(content).toBe('Hello from Tauri!');
  });
});
```

## API Reference

### TauriService

Main service class for WebDriverIO integration.

#### Methods

- `getCommands()` - Get TauriCommands instance
- `getOptions()` - Get current service options
- `updateOptions(options)` - Update service options

### TauriCommands

Core commands for interacting with Tauri applications.

#### Window Management

- `getWindowBounds()` - Get current window bounds
- `setWindowBounds(bounds)` - Set window bounds

#### Screenshot

- `captureScreenshot(options?)` - Capture screenshot

#### File Operations

- `readFile(path, options?)` - Read file content
- `writeFile(path, content, options?)` - Write file content

#### System Information

- `getProcessInfo()` - Get process information
- `getPlatformInfo()` - Get platform information

#### Clipboard

- `getClipboard()` - Get clipboard content
- `setClipboard(content)` - Set clipboard content

#### Process Management

- `launchApp(path, args?)` - Launch external application
- `killProcess(pid)` - Kill process by PID

## Configuration Options

### Service Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `commandTimeout` | number | 30000 | Timeout for Tauri commands (ms) |
| `debug` | boolean | false | Enable debug logging |
| `appPath` | string | - | Path to Tauri application |
| `appArgs` | string[] | [] | Additional app arguments |

### Screenshot Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | 'png' \| 'jpeg' | 'png' | Screenshot format |
| `quality` | number | 90 | JPEG quality (0-100) |
| `fullPage` | boolean | false | Capture full window |

### File Operation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `encoding` | BufferEncoding | 'utf8' | Text file encoding |
| `createDirectories` | boolean | false | Create directories if missing |

## Platform Limitations

### macOS Not Supported

⚠️ **Important**: macOS is not supported due to the lack of a WKWebView WebDriver implementation. The service will:

- Log a warning when running on macOS
- Some commands may fail or behave unexpectedly
- Consider using Linux or Windows for testing

### Platform-Specific Features

#### Windows
- Uses Microsoft Edge WebDriver
- Full Win32 API access via Rust crates
- Process management and system information

#### Linux
- Uses WebKitWebDriver
- POSIX API access via Rust crates
- File system and process operations

## Troubleshooting

### Common Issues

1. **"tauri-driver not found"**
   ```bash
   cargo install tauri-driver
   ```

2. **"WebDriver not found"**
   - Windows: Install Microsoft Edge WebDriver
   - Linux: Install webkit2gtk-driver

3. **"macOS not supported"**
   - Use Linux or Windows for testing
   - Consider using GitHub Actions with Linux runners

4. **Commands timing out**
   - Increase `commandTimeout` in service options
   - Check if Tauri app is responding

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
services: [
  ['@wdio/tauri-service', {
    debug: true,
    commandTimeout: 60000
  }]
]
```

## Examples

See the `examples/tauri-test-app` directory for a complete example application with tests.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
