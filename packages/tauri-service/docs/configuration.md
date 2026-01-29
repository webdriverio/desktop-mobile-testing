# Configuration Reference

Complete guide to configuring @wdio/tauri-service in your WebdriverIO setup.

## Service Configuration

Add the Tauri service to your `wdio.conf.ts`:

```typescript
export const config = {
  services: [
    ['@wdio/tauri-service', {
      // Service options go here
      autoInstallTauriDriver: true,
      autoDownloadEdgeDriver: true,
      captureBackendLogs: true,
      captureFrontendLogs: true,
    }]
  ],
  // ... rest of config
};
```

## Service Options

### `appBinaryPath` (string, optional)

Path to the compiled Tauri application binary (executable).

**Example:**
```typescript
appBinaryPath: './src-tauri/target/release/my-app.exe',  // Windows
appBinaryPath: './src-tauri/target/release/my-app',     // Linux
```

**Default:** Auto-detected from capabilities if not provided

**Note:** Path should be absolute or relative to the WebdriverIO config directory.

---

### `appArgs` (string[], optional)

Command-line arguments to pass to the Tauri application when launching.

**Example:**
```typescript
appArgs: ['--debug', '--log-level', 'debug']
```

**Default:** `[]`

---

### `autoInstallTauriDriver` (boolean, optional)

Automatically install `tauri-driver` if not found in PATH.

**Requirements:**
- Rust toolchain must be installed (`cargo`)
- First installation will take a few minutes

**Example:**
```typescript
autoInstallTauriDriver: true
```

**Default:** `false`

**Note:** Disable if you have `tauri-driver` installed manually or globally.

---

### `autoDownloadEdgeDriver` (boolean, optional)

Automatically download MSEdgeDriver on Windows if version mismatch detected.

**Example:**
```typescript
autoDownloadEdgeDriver: true  // Windows only
```

**Default:** `true`

**Note:** Windows only, ignored on Linux/macOS. See [Edge WebDriver Windows](./edge-webdriver-windows.md).

---

### `tauriDriverPort` (number, optional)

Port for tauri-driver to listen on. Each worker process gets a unique port (port + worker index).

**Example:**
```typescript
tauriDriverPort: 4444
```

**Default:** `4444`

**Note:** Increment for multiremote to avoid port conflicts.

---

### `tauriDriverPath` (string, optional)

Path to the `tauri-driver` executable if not in PATH.

**Example:**
```typescript
tauriDriverPath: '/usr/local/bin/tauri-driver'  // Linux/macOS
tauriDriverPath: 'C:\\tools\\tauri-driver.exe'  // Windows
```

**Default:** Use `tauri-driver` from PATH

---

### `logLevel` ('trace' | 'debug' | 'info' | 'warn' | 'error', optional)

Log level for tauri-driver output.

**Example:**
```typescript
logLevel: 'debug'  // More verbose
```

**Default:** `'info'`

---

### `commandTimeout` (number, optional)

Timeout in milliseconds for individual command execution.

**Example:**
```typescript
commandTimeout: 30000  // 30 seconds
```

**Default:** `10000` (10 seconds)

---

### `startTimeout` (number, optional)

Timeout in milliseconds for the Tauri app to start and become ready.

**Example:**
```typescript
startTimeout: 30000  // 30 seconds
```

**Default:** `30000`

---

### `captureBackendLogs` (boolean, optional)

Capture logs from the Tauri backend (Rust code).

**Example:**
```typescript
captureBackendLogs: true
```

**Default:** `false`

**Note:** When enabled, logs appear in WebdriverIO reports. See [Log Forwarding](./log-forwarding.md).

---

### `captureFrontendLogs` (boolean, optional)

Capture console logs from the frontend (JavaScript/TypeScript).

**Example:**
```typescript
captureFrontendLogs: true
```

**Default:** `false`

**Note:** When enabled, console.log() calls appear in WebdriverIO reports. See [Log Forwarding](./log-forwarding.md).

---

### `backendLogLevel` ('trace' | 'debug' | 'info' | 'warn' | 'error', optional)

Minimum log level to capture from backend. Logs below this level are ignored.

**Example:**
```typescript
backendLogLevel: 'debug'  // Capture debug and above
```

**Default:** `'info'`

**Note:** Only has effect if `captureBackendLogs: true`.

---

### `frontendLogLevel` ('trace' | 'debug' | 'info' | 'warn' | 'error', optional)

Minimum log level to capture from frontend. Logs below this level are ignored.

**Example:**
```typescript
frontendLogLevel: 'debug'
```

**Default:** `'info'`

**Note:** Only has effect if `captureFrontendLogs: true`.

---

### `logDir` (string, optional)

Directory to store logs from the Tauri service (for standalone mode).

**Example:**
```typescript
logDir: './test-logs'
```

**Default:** Logs to stdout/stderr

---

### `driverProvider` ('official' | 'crabnebula', optional)

Select which driver provider to use for WebDriver communication.

- `'official'`: Use the cargo-installed tauri-driver (default, supports Windows/Linux)
- `'crabnebula'`: Use @crabnebula/tauri-driver from npm (supports Windows/Linux/macOS)

**Example:**
```typescript
driverProvider: 'crabnebula'  // Enable macOS support
```

**Default:** `'official'`

**Note:** CrabNebula driver requires a subscription and API key for macOS. See [Platform Support](./platform-support.md) for details.

---

### `crabnebulaDriverPath` (string, optional)

Path to the @crabnebula/tauri-driver executable. Only used when `driverProvider: 'crabnebula'`.

**Example:**
```typescript
crabnebulaDriverPath: './node_modules/.bin/tauri-driver'
```

**Default:** Auto-detected from node_modules

---

### `crabnebulaManageBackend` (boolean, optional)

Auto-manage the test-runner-backend process (macOS only). When enabled, the service will automatically start and stop the backend.

**Example:**
```typescript
crabnebulaManageBackend: true
```

**Default:** `true` when using CrabNebula on macOS

---

### `crabnebulaBackendPort` (number, optional)

Port for the test-runner-backend to listen on (macOS only).

**Example:**
```typescript
crabnebulaBackendPort: 3000
```

**Default:** `3000`

---

## Capabilities Configuration

Configure Tauri-specific capabilities in your `capabilities` array:

### Basic Configuration

```typescript
capabilities: [{
  browserName: 'tauri',
  'tauri:options': {
    application: './src-tauri/target/release/my-app.exe'
  }
}]
```

### Full Configuration

```typescript
capabilities: [{
  browserName: 'tauri',
  'tauri:options': {
    application: './src-tauri/target/release/my-app.exe',
    args: ['--debug']
  },
  // Optional: override service settings per capability
  // tauriDriverPort: 4445,
}]
```

### Multiremote Configuration

Run multiple instances of the app:

```typescript
capabilities: {
  app1: {
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/release/my-app.exe'
    }
  },
  app2: {
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/release/my-app.exe'
    }
  }
}
```

Or as array:

```typescript
capabilities: [
  {
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/release/my-app.exe'
    }
  },
  {
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/release/my-app.exe'
    }
  }
]
```

## Complete Configuration Example

```typescript
// wdio.conf.ts
export const config = {
  runner: 'local',

  // Specs
  specs: ['./test/specs/**/*.spec.ts'],
  exclude: ['./test/specs/integration/**/*.spec.ts'],

  // Parallelization
  maxInstances: 1,
  maxInstancesPerCapability: 1,

  // Tauri Service
  services: [
    ['@wdio/tauri-service', {
      appBinaryPath: './src-tauri/target/release/my-app.exe',
      appArgs: ['--debug'],
      autoInstallTauriDriver: true,
      autoDownloadEdgeDriver: true,  // Windows only
      tauriDriverPort: 4444,
      logLevel: 'info',
      commandTimeout: 30000,
      startTimeout: 30000,
      captureBackendLogs: true,
      captureFrontendLogs: true,
      backendLogLevel: 'debug',
      frontendLogLevel: 'debug',
    }]
  ],

  // Capabilities
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/release/my-app.exe',
      args: ['--debug']
    }
  }],

  // Connection settings
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4444',
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 3,

  // Framework
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  },

  // Reporters
  reporters: ['spec'],

  // Hooks
  onPrepare: async (config, capabilities) => {
    console.log('Starting test run...');
  },

  onComplete: async (exitCode, config, capabilities, results) => {
    console.log('Test run completed');
  }
};
```

## Platform-Specific Configuration

### Windows Configuration

Enable auto Edge WebDriver management:

```typescript
services: [
  ['@wdio/tauri-service', {
    appBinaryPath: './src-tauri/target/release/my-app.exe',
    autoDownloadEdgeDriver: true,  // Auto-download on version mismatch
  }]
]
```

### Linux Configuration

WebKitWebDriver is auto-detected:

```typescript
services: [
  ['@wdio/tauri-service', {
    appBinaryPath: './src-tauri/target/release/my-app',
    autoInstallTauriDriver: true,
  }]
]
```

### Headless Configuration (Linux)

Run tests without a display server:

```typescript
services: [
  ['@wdio/tauri-service', {
    appBinaryPath: './src-tauri/target/release/my-app',
    // Xvfb is auto-detected if available (WebdriverIO 9.19.1+)
  }]
]
```

## Finding Your appBinaryPath

### Windows

Build your app:
```bash
cd src-tauri
cargo build --release
```

Binary is at:
```
./src-tauri/target/release/my-app.exe
```

(Replace `my-app` with your app name from `Cargo.toml`)

### Linux

Build your app:
```bash
cd src-tauri
cargo build --release
```

Binary is at:
```
./src-tauri/target/release/my-app
```

(Replace `my-app` with your app name)

### Verify Binary Exists

```bash
# Windows
if exist "src-tauri\target\release\my-app.exe" echo "Binary found"

# Linux/macOS
ls -la src-tauri/target/release/my-app
```

## Configuration Validation

Check your configuration with:

```bash
# Verify service can be loaded
npx wdio config

# Run with verbose logging
npx wdio run wdio.conf.ts --logLevel debug
```

## Common Configuration Patterns

### Development Configuration

```typescript
export const config = {
  // ... other settings
  services: [
    ['@wdio/tauri-service', {
      appBinaryPath: './src-tauri/target/release/my-app.exe',
      autoInstallTauriDriver: true,
      autoDownloadEdgeDriver: true,
      captureBackendLogs: true,
      captureFrontendLogs: true,
      backendLogLevel: 'debug',
      frontendLogLevel: 'debug',
      logLevel: 'debug',
    }]
  ],
};
```

### CI/CD Configuration

```typescript
export const config = {
  // ... other settings
  services: [
    ['@wdio/tauri-service', {
      appBinaryPath: process.env.APP_BINARY || './src-tauri/target/release/my-app.exe',
      autoInstallTauriDriver: true,
      autoDownloadEdgeDriver: true,
      captureBackendLogs: true,
      captureFrontendLogs: true,
      logLevel: 'info',
    }]
  ],
};
```

### Production-Like Configuration

```typescript
export const config = {
  // ... other settings
  services: [
    ['@wdio/tauri-service', {
      appBinaryPath: './src-tauri/target/release/my-app.exe',
      autoInstallTauriDriver: false,  // Pre-installed
      autoDownloadEdgeDriver: false,  // Pre-downloaded
      captureBackendLogs: false,
      captureFrontendLogs: false,
      logLevel: 'warn',
    }]
  ],
};
```

## Troubleshooting Configuration Issues

**"Cannot find appBinaryPath"**

1. Verify path exists:
   ```bash
   ls -la src-tauri/target/release/my-app*
   ```

2. Build the app first:
   ```bash
   cd src-tauri && cargo build --release
   ```

3. Use absolute path in config:
   ```typescript
   appBinaryPath: path.resolve('./src-tauri/target/release/my-app.exe')
   ```

**"Service not found"**

Ensure service is installed:
```bash
npm list @wdio/tauri-service
```

If missing:
```bash
npm install --save-dev @wdio/tauri-service
```

**"Port already in use"**

Change the tauri-driver port:
```typescript
tauriDriverPort: 4445  // Instead of 4444
```

Or enable multiremote with auto-port assignment:
```typescript
maxInstances: 3  // Each gets unique port
```

## See Also

- [Quick Start](./quick-start.md) for getting started
- [Plugin Setup](./plugin-setup.md) for Tauri plugin configuration
- [API Reference](./api-reference.md) for available functions
- [Log Forwarding](./log-forwarding.md) for logging configuration
