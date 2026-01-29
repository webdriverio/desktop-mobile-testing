# Platform Support

Complete guide to platform-specific requirements, limitations, and WebDriver setup for Tauri testing.

## Platform Support Overview

| Platform | Supported | WebDriver | Setup | Notes |
|----------|-----------|-----------|-------|-------|
| **Windows** | ✅ Yes | Microsoft Edge WebDriver | Auto-managed | Stable, fully tested |
| **Linux** | ✅ Yes | WebKitWebDriver | Manual install | Full feature support |
| **macOS** | ✅ Yes (via CrabNebula) | CrabNebula WebDriver | NPM packages | Requires subscription |

## Windows

### WebDriver: Microsoft Edge WebDriver

Windows uses the **Microsoft Edge WebDriver** (msedgedriver.exe) which communicates with the WebView2 runtime embedded in your Tauri app.

#### Auto-Management (Recommended)

The service automatically:
1. Detects the WebView2 version in your Tauri binary
2. Downloads the matching MSEdgeDriver if missing
3. Handles version mismatches

**Configuration:**

```typescript
services: [['@wdio/tauri-service', {
  autoDownloadEdgeDriver: true,  // Default: true
}]],
```

#### Manual Setup

If auto-management fails:

1. **Detect your WebView2 version**
   - Build your app: `cargo build --release`
   - Right-click the .exe → Properties → Details
   - Note the "File version" (e.g., 143.0.3650.139)

2. **Download matching MSEdgeDriver**
   - Visit [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)
   - Download the version matching your WebView2
   - Extract to PATH or specify in config

3. **Configure WebdriverIO**
   ```typescript
   services: [['@wdio/tauri-service', {
     autoDownloadEdgeDriver: false,
     tauriDriverPort: 4444,
   }]],
   ```

#### Troubleshooting Windows Issues

**"This version of Microsoft Edge WebDriver only supports Microsoft Edge version X"**

Version mismatch between driver and WebView2. Solutions:

1. Enable auto-download (default):
   ```typescript
   autoDownloadEdgeDriver: true
   ```

2. Or manually match versions:
   - Check WebView2 version in your binary
   - Download corresponding MSEdgeDriver
   - Update PATH or config

**"msedgedriver.exe not found"**

1. Check if installed:
   ```bash
   where msedgedriver.exe
   ```

2. Install or download from [Microsoft Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/)

3. Add to PATH or disable auto-download and specify manually

### Windows-Specific Features

- ✅ Full Tauri API support
- ✅ Command execution
- ✅ Mocking with tauri-plugin-wdio
- ✅ Log capture (frontend and backend)
- ✅ Screenshot capture
- ✅ File operations
- ✅ Multiremote testing

### Requirements

- **Visual C++ Build Tools** or Visual Studio
- **Rust toolchain** (for building Tauri apps)
- **Node.js 18+**

## Linux

### WebDriver: WebKitWebDriver

Linux uses **WebKitWebDriver** (WebKitGTK) which communicates with the Tauri app's WebKit runtime.

#### Installation by Distribution

**Debian/Ubuntu (✅ Supported)**

```bash
sudo apt-get update
sudo apt-get install -y webkit2gtk-driver

# Verify installation
which webkit2gtk-driver
```

**Fedora 40+ (✅ Supported)**

```bash
sudo dnf install -y webkit2gtk-driver

# Verify installation
which webkit2gtk-driver
```

**Arch Linux (✅ Supported)**

WebKitWebDriver is provided by webkit2gtk:

```bash
sudo pacman -S webkit2gtk-4.1

# Verify installation
which webkit2gtk-driver
```

**Void Linux (✅ Supported)**

```bash
sudo xbps-install -y webkit2gtk-devel

# Verify installation
which webkit2gtk-driver
```

**Alpine Linux (❌ Not Supported)**

Alpine uses musl C library which is incompatible with Tauri app building. Alpine can only be used as a **runtime container**, not for building Tauri apps.

**CentOS Stream / RHEL (❌ Not Supported)**

- **Stream 9 / RHEL 9**: glib 2.68 is too old (requires 2.70+)
- **Stream 10 / RHEL 10**: WebKitGTK intentionally removed due to security vulnerabilities

**Recommendation:** Use **Fedora 40+** for RHEL-based distributions.

**openSUSE / SUSE (❌ Not Supported)**

No official WebKitWebDriver package. Building from source is complex and not recommended.

**Other Distributions**

Check if webkit2gtk is available:

```bash
# Debian-based
apt search webkit2gtk-driver

# RedHat-based
dnf search webkit2gtk-driver

# Pacman-based
pacman -Ss webkit2gtk
```

#### Headless Testing

To run tests without a display (CI/CD environments):

**With Xvfb (X Virtual Framebuffer)**

Install Xvfb:

```bash
sudo apt-get install -y xvfb  # Debian/Ubuntu
sudo dnf install -y xvfb      # Fedora
```

Run tests:

```bash
xvfb-run -a npm run test:e2e
```

Or automatically via WebdriverIO (requires wdio 9.19.1+):

```typescript
services: [['@wdio/tauri-service', {
  // Xvfb is auto-detected and used if available
}]],
```

**With Wayland**

If you're on a Wayland desktop:

```bash
# Set XWayland if needed
export GDK_BACKEND=x11
npm run test:e2e
```

#### Troubleshooting Linux Issues

**"webkit2gtk-driver not found"**

1. Verify installation:
   ```bash
   which webkit2gtk-driver
   ```

2. If not found, install for your distribution (see above)

3. Add to PATH if in non-standard location:
   ```bash
   export PATH="/path/to/driver:$PATH"
   ```

**"X11 connection refused" or "Cannot open display"**

Your system doesn't have a display server. Solutions:

1. **Use Xvfb**
   ```bash
   xvfb-run -a npm run test:e2e
   ```

2. **Or use Docker with X11 forwarding**
   ```bash
   docker run -e DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix my-image
   ```

3. **Or enable headless mode** (if supported):
   ```bash
   export WAYLAND_DISPLAY=""
   npm run test:e2e
   ```

**"glib version too old"**

CentOS Stream / RHEL issue. Use **Fedora 40+** instead.

**"Permission denied" when installing webkit2gtk**

Use `sudo` for package installation:

```bash
sudo apt-get install webkit2gtk-driver
```

### Linux-Specific Features

- ✅ Full Tauri API support
- ✅ Command execution
- ✅ Mocking with tauri-plugin-wdio
- ✅ Log capture (frontend and backend)
- ✅ Screenshot capture
- ✅ File operations
- ✅ Headless testing with Xvfb
- ✅ Multiremote testing

### Requirements

- **WebKitGTK development libraries** (webkit2gtk-driver)
- **Xvfb** (optional, for headless testing)
- **Rust toolchain** (for building Tauri apps)
- **Node.js 18+**

## macOS

### Supported via CrabNebula ✅ (Requires Subscription)

macOS testing is supported through [CrabNebula](https://crabnebula.dev)'s `@crabnebula/tauri-driver` package. This is a fork of the official tauri-driver that adds macOS support via a proprietary WebDriver implementation.

#### Requirements

1. **CrabNebula Account** with API key
2. **tauri-plugin-automation** installed in your Tauri app
3. **@crabnebula/tauri-driver** npm package
4. **@crabnebula/test-runner-backend** npm package (for local testing)

#### Setup

1. Install CrabNebula packages:
   ```bash
   npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
   ```

2. Add the automation plugin to your Tauri app:
   ```bash
   cd src-tauri && cargo add tauri-plugin-automation
   ```

3. Register the plugin in your Rust code (debug builds only):
   ```rust
   let mut builder = tauri::Builder::default();
   #[cfg(debug_assertions)]
   {
     builder = builder.plugin(tauri_plugin_automation::init());
   }
   ```

4. Set your API key:
   ```bash
   export CN_API_KEY="your-api-key"
   ```

5. Configure WebdriverIO:
   ```typescript
   services: [['@wdio/tauri-service', {
     driverProvider: 'crabnebula',
   }]]
   ```

See the [CrabNebula documentation](https://docs.crabnebula.dev/tauri/webdriver/) for more details.

### Alternatives for macOS

If you cannot use CrabNebula, consider:

1. **UI Testing Framework**
   - Use XCTest (Apple's native testing framework)
   - Or Xcode's UI testing capabilities

2. **Manual Testing**
   - Develop and test on Windows/Linux with WebdriverIO
   - Perform manual QA on macOS

3. **Web Version**
   - Deploy a web version of your app
   - Test with traditional WebdriverIO setup

4. **Cross-Platform Testing**
   - Write once, test on Windows/Linux
   - Rely on platform coverage for macOS

### Building on macOS

You can **build** Tauri apps on macOS:

```bash
npm install
npm run tauri build
```

Testing requires either CrabNebula (see above) or an alternative approach.

### Example CI Configuration

If you're developing on macOS but testing on Linux:

```yaml
# .github/workflows/test.yml
jobs:
  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions-rs/toolchain@v1
      - run: npm install
      - run: npm run tauri build
      - run: npm run test:e2e

  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - uses: actions-rs/toolchain@v1
      - run: npm install
      - run: npm run tauri build
      # No test step - just build verification
```

## Cross-Platform Tips

### CI/CD Matrix

Test on multiple platforms:

```typescript
// wdio.conf.ts - Example for matrix testing
export const config = {
  onPrepare: async (config, specs) => {
    const platform = process.platform;
    const arch = process.arch;

    console.log(`Testing on ${platform}-${arch}`);

    if (platform === 'win32') {
      config.services = [['@wdio/tauri-service', {
        autoDownloadEdgeDriver: true,
      }]];
    } else if (platform === 'linux') {
      config.services = [['@wdio/tauri-service', {
        // WebKitWebDriver auto-detected
      }]];
    } else if (platform === 'darwin') {
      console.warn('macOS testing not supported - skipping E2E tests');
      process.exit(0);
    }
  },
};
```

### Platform-Specific Tests

Skip tests on unsupported platforms:

```typescript
describe('Platform-specific features', () => {
  it('should handle Windows path format', function() {
    if (process.platform !== 'win32') {
      this.skip();
    }
    // Windows-specific test
  });

  it('should handle Linux file permissions', function() {
    if (process.platform !== 'linux') {
      this.skip();
    }
    // Linux-specific test
  });
});
```

## Summary

- **Windows** - Fully supported with auto-managed Edge WebDriver ✅
- **Linux** - Fully supported with manual WebKitWebDriver setup ✅
- **macOS** - Not supported, building only ❌

Choose Windows or Linux for automated testing, or use Docker containers for consistent cross-platform testing.

## See Also

- [Quick Start](./quick-start.md) for setup instructions
- [Edge WebDriver Windows](./edge-webdriver-windows.md) for Windows-specific details
- [Troubleshooting](./troubleshooting.md) for common issues
- [Tauri Platform-Specific Docs](https://v2.tauri.app/guides/develop/development-cycle/)
