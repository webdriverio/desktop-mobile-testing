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

   **Option A: Automatic Installation (Recommended)**

   Enable auto-installation in your WebDriverIO config:
   ```typescript
   services: [
     ['@wdio/tauri-service', {
       autoInstallTauriDriver: true, // Automatically install if missing
     }]
   ]
   ```

   **Option B: Manual Installation**

   ```bash
   cargo install tauri-driver
   ```

   **Note:** Automatic installation requires Rust toolchain (`cargo`) to be installed. Get Rust from [https://rustup.rs/](https://rustup.rs/).

3. **Platform-specific WebDriver** (REQUIRED):
   - **Windows**: Microsoft Edge WebDriver (msedgedriver)
     - ✅ Automatically handled by tauri-driver
     - No manual installation needed

   - **Linux**: WebKitWebDriver (webkit2gtk-driver)
     - ⚠️ **Must be installed manually** (not auto-installed by this service)
     - Installation commands by distro:
       ```bash
       # Debian/Ubuntu (Supported)
       sudo apt-get install -y webkit2gtk-driver

       # Fedora 40+ (Supported)
       sudo dnf install -y webkit2gtk-driver

       # Arch Linux (Supported)
       sudo pacman -S webkit2gtk-4.1  # Provides WebKitWebDriver

       # Void Linux
       sudo xbps-install -y webkit2gtk-devel
       ```
     - ⚠️ **Unsupported Distributions:**
       - **Alpine Linux**: Cannot build Tauri apps (musl/static linking incompatibility). Can only be used for runtime containers.
       - **CentOS Stream / RHEL**:
         - Stream 9 / RHEL 9: glib too old (2.68 < 2.70 required)
         - Stream 10 / RHEL 10: WebKitGTK intentionally removed due to security vulnerabilities
         - Use **Fedora 40+** for RHEL-based workflows
       - **SUSE/openSUSE**: No official WebKitWebDriver package. Must build from source.
     - The service will detect your package manager and provide specific instructions if WebKitWebDriver is not found

### Platform Support

| Platform | Supported | WebDriver | Installation | Notes |
|-----------|------------|-----------|--------------|-------|
| Windows | ✅ | Edge WebDriver | Automatic | Stable and tested |
| Linux | ✅ | WebKitWebDriver | **Manual** | See [Linux Distribution Support](#linux-distribution-support) |
| macOS | ❌ | None | N/A | No WKWebView driver support |

### Linux Distribution Support

| Distribution | Status | glib Version | webkit2gtk | Notes |
|-------------|---------|-------------|-----------|-------|
| Ubuntu 24.04 | ✅ Supported | 2.80+ | ✅ | Stable, well-tested |
| Debian 12+ | ✅ Supported | 2.74+ | ✅ | Rock-solid stability |
| Fedora 40+ | ✅ Supported | 2.80+ | ✅ | Latest packages |
| Arch Linux | ✅ Supported | 2.82+ | ✅ | Rolling release |
| Void Linux | ✅ Supported | 2.78+ | ✅ | Independent, rolling |
| Alpine Linux | ❌ Unsupported | 2.86+ | ❌ | musl/static linking incompatible |
| CentOS Stream 9 | ❌ Unsupported | 2.68 | ❌ | glib too old (< 2.70) |
| CentOS Stream 10 | ❌ Unsupported | 2.80+ | ❌ | WebKitGTK removed for security |
| SUSE/openSUSE | ⚠️ Limited | Varies | ⚠️ | Must build from source |

**Requirements for all Linux distributions:**
- glib-2.0 >= 2.70 (critical)
- webkit2gtk 4.0 or 4.1 (critical)
- glibc (musl unsupported for building)

**Why certain distributions are unsupported:**

- **Alpine Linux**: Uses musl libc which defaults to static linking. GTK/webkit libraries don't provide static versions (`.a` files), making it impossible to build Tauri apps. Alpine can be used for runtime-only containers with pre-built binaries.

- **CentOS Stream 10 / RHEL 10**: WebKitGTK was intentionally removed by Red Hat due to:
  - 200+ unfixed CVEs enabling remote code execution
  - Unsustainable maintenance burden (frequent upstream changes incompatible with 10-year RHEL lifecycle)
  - Strategic shift to QtWebEngine (Chromium-based) for better security
  - [Red Hat RHEL 10 Release Notes](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/10.0_release_notes/removed-features)

- **CentOS Stream 9 / RHEL 9**: Ships with glib 2.68.4, but Tauri requires glib >= 2.70.

**Recommendation:** For RHEL-based workflows, use **Fedora 40+** which has both modern glib and webkit2gtk packages.

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

## Log Forwarding

The Tauri service can capture and forward logs from both the Rust backend and frontend console to WebDriverIO's logger system. This allows you to see Tauri application logs seamlessly integrated with your test output.

### Enabling Log Forwarding

Log forwarding is disabled by default. Enable it via service options:

```typescript
// wdio.conf.ts
export const config = {
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: './path/to/app',
      },
      'wdio:tauriServiceOptions': {
        // Enable backend log capture (Rust logs from stdout)
        captureBackendLogs: true,
        // Enable frontend log capture (console logs from webview)
        captureFrontendLogs: true,
        // Minimum log level for backend logs (default: 'info')
        backendLogLevel: 'info',
        // Minimum log level for frontend logs (default: 'info')
        frontendLogLevel: 'info',
      },
    },
  ],
  services: [['@wdio/tauri-service']],
};
```

### Log Levels

Both backend and frontend log capture support the following log levels (in order of priority):

- `trace` - Most verbose
- `debug` - Debug information
- `info` - Informational messages (default)
- `warn` - Warning messages
- `error` - Error messages

Only logs at the configured level and above will be captured. For example, with `backendLogLevel: 'info'`, only `info`, `warn`, and `error` logs will be captured.

### Log Format

Captured logs are formatted with context tags:

- Backend logs: `[Tauri:Backend] message`
- Frontend logs: `[Tauri:Frontend] message`
- Multiremote logs: `[Tauri:Backend:instanceId] message` or `[Tauri:Frontend:instanceId] message`

### Backend Log Capture

Backend log capture reads Rust logs from the Tauri application's stdout. These logs are generated using Rust's `log` crate:

```rust
// In your Tauri app
log::info!("This is an info log");
log::warn!("This is a warning");
log::error!("This is an error");
```

The service automatically filters out tauri-driver logs and only captures logs from your Tauri application.

### Frontend Log Capture

Frontend log capture uses WebDriver's `getLogs` API to retrieve console logs from the webview:

```javascript
// In your Tauri app frontend
console.info('This is an info log');
console.warn('This is a warning');
console.error('This is an error');
```

Frontend logs are captured periodically (every second) and before each WebDriver command to ensure all logs are captured.

### Independent Configuration

Backend and frontend log capture can be configured independently:

```typescript
'wdio:tauriServiceOptions': {
  // Only capture backend logs
  captureBackendLogs: true,
  captureFrontendLogs: false,
  backendLogLevel: 'debug', // Capture debug and above
},
```

### Multiremote Support

In multiremote scenarios, logs are captured per instance with instance IDs in the log context:

```typescript
capabilities: {
  browserA: {
    capabilities: {
      'wdio:tauriServiceOptions': {
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    },
  },
  browserB: {
    capabilities: {
      'wdio:tauriServiceOptions': {
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    },
  },
},
```

Logs will appear as:
- `[Tauri:Backend:browserA] message`
- `[Tauri:Frontend:browserB] message`

### Performance Considerations

- Log capture is optional and disabled by default to avoid overhead
- Frontend log capture uses periodic polling (every 1 second) which has minimal performance impact
- Backend log parsing is efficient and non-blocking
- Log level filtering reduces the number of logs processed

### Troubleshooting

**Logs not appearing:**
- Ensure `captureBackendLogs` or `captureFrontendLogs` is set to `true`
- Check that your log level is appropriate (logs below the configured level won't appear)
- Verify logs are being written to stdout (backend) or console (frontend)

**Too many logs:**
- Increase the log level (e.g., from `debug` to `info`) to filter out verbose logs
- Disable log capture for one source if you only need backend or frontend logs

**Frontend logs not captured:**
- Some WebDriver implementations may not support `getLogs` API
- The service will silently fail if `getLogs` is not supported
- Backend logs will still work in this case

## Configuration Options

### Driver Management

The Tauri service can automatically manage `tauri-driver` installation:

```typescript
services: [
  ['@wdio/tauri-service', {
    // Automatically install tauri-driver if not found (requires Rust/cargo)
    autoInstallTauriDriver: false, // Default: false (opt-in for safety)

    // Custom path to tauri-driver binary (overrides auto-install)
    tauriDriverPath: '/custom/path/to/tauri-driver',

    // Custom path to native driver (WebKitWebDriver on Linux, msedgedriver on Windows)
    nativeDriverPath: '/custom/path/to/WebKitWebDriver',
  }]
]
```

**Note:** When `autoInstallTauriDriver` is enabled, the service will:
1. Check if `tauri-driver` exists in PATH or common installation paths
2. If not found and `cargo` is available, automatically install via `cargo install tauri-driver` to `~/.cargo/bin`
3. If `cargo` is not available, provide a helpful error message with installation instructions

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

   **Option 1: Enable auto-installation**
   ```typescript
   services: [
     ['@wdio/tauri-service', {
       autoInstallTauriDriver: true, // Requires Rust/cargo
     }]
   ]
   ```

   **Option 2: Manual installation**
   ```bash
   cargo install tauri-driver
   ```

2. **"WebKitWebDriver not found" (Linux only)**
   - Install webkit2gtk-driver on supported distributions:
     ```bash
     sudo apt-get install -y webkit2gtk-driver  # Debian/Ubuntu
     sudo dnf install -y webkit2gtk-driver      # Fedora 40+
     sudo pacman -S webkit2gtk-4.1              # Arch Linux
     sudo xbps-install -y webkit2gtk-devel      # Void Linux
     ```
   - **If using unsupported distributions:**
     - **Alpine Linux**: Cannot build Tauri apps (musl incompatibility). Use Ubuntu/Debian/Fedora/Arch instead.
     - **CentOS/RHEL**: Stream 9 has glib too old, Stream 10 removed WebKitGTK. Use **Fedora 40+** instead.
     - **SUSE/openSUSE**: No official package - must build WebKitGTK from source.
   - The service will detect your package manager and provide specific instructions if not found

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
