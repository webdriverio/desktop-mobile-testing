# CrabNebula Tauri Driver - Quick Start Guide

This guide helps users get started with CrabNebula's tauri-driver for macOS testing support in `@wdio/tauri-service`.

## Prerequisites

1. **CrabNebula Account** with API key (required for macOS)
2. **Tauri app** with tauri-plugin-automation installed
3. **Node.js 18+** and **Rust toolchain**

## Installation

### Step 1: Install CrabNebula Packages

```bash
npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
```

Or with pnpm/yarn:
```bash
pnpm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
```

### Step 2: Add Automation Plugin to Your Tauri App

```bash
cd src-tauri
cargo add tauri-plugin-automation
```

### Step 3: Register the Plugin (Conditional)

In your `src-tauri/src/lib.rs` or `main.rs`:

```rust
let mut builder = tauri::Builder::default();

#[cfg(debug_assertions)]  // Only for debug builds
{
  builder = builder.plugin(tauri_plugin_automation::init());
}

builder
  .run(tauri::generate_context!())
  .expect("error while running tauri application");
```

> ⚠️ **Important**: Always use conditional compilation to exclude the automation plugin from production builds.

### Step 4: Set Environment Variable

```bash
export CN_API_KEY="your-api-key-from-crabnebula"
```

Or in your CI/CD environment, add it as a secret.

### Step 5: Update WebdriverIO Configuration

```typescript
// wdio.conf.ts
export const config = {
  services: [
    ['@wdio/tauri-service', {
      driverProvider: 'crabnebula',  // Use CrabNebula driver
      crabnebulaManageBackend: true,  // Auto-manage test-runner-backend
    }]
  ],
  
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/debug/your-app',
    },
  }],
  
  // ... rest of your config
};
```

### Step 6: Build Your App

```bash
npm run tauri build -- --debug
```

### Step 7: Run Tests

```bash
npm run wdio
```

## Configuration Reference

### Service Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `driverProvider` | `'official' \| 'crabnebula'` | `'official'` | Which driver to use |
| `crabnebulaDriverPath` | `string` | auto-detected | Path to CrabNebula driver binary |
| `crabnebulaManageBackend` | `boolean` | `true` | Auto-start test-runner-backend (macOS) |
| `crabnebulaBackendPort` | `number` | `3000` | Port for test-runner-backend |

### Platform-Specific Behavior

| Platform | Official Driver | CrabNebula Driver |
|----------|-----------------|-------------------|
| Windows | ✅ msedgedriver | ✅ msedgedriver |
| Linux | ✅ webkit2gtk-driver | ✅ webkit2gtk-driver |
| macOS | ❌ Not supported | ✅ Requires API key |

## Troubleshooting

### "CN_API_KEY is not set"

**Solution**: Set the environment variable:
```bash
export CN_API_KEY="your-api-key"
```

Or in your CI/CD:
```yaml
env:
  CN_API_KEY: ${{ secrets.CN_API_KEY }}
```

### "@crabnebula/tauri-driver not found"

**Solution**: Install the package:
```bash
npm install -D @crabnebula/tauri-driver
```

### "tauri-plugin-automation not found"

**Solution**: Add the plugin to your Tauri app:
```bash
cd src-tauri && cargo add tauri-plugin-automation
```

Then register it in your Rust code with conditional compilation.

### "test-runner-backend exited with code X"

**Possible causes**:
- CN_API_KEY is invalid or expired
- Port 3000 is already in use (change `crabnebulaBackendPort`)
- macOS permissions issue (check System Preferences > Security)

### Tests work on Linux/Windows but not macOS

**Checklist**:
1. ✅ CN_API_KEY is set
2. ✅ tauri-plugin-automation is installed
3. ✅ Plugin is registered with `#[cfg(debug_assertions)]`
4. ✅ App is built in debug mode
5. ✅ @crabnebula/tauri-driver is installed
6. ✅ @crabnebula/test-runner-backend is installed

## CI/CD Example

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-action@stable
      
      - name: Install dependencies
        run: npm install
      
      - name: Install CrabNebula (macOS only)
        if: matrix.os == 'macos-latest'
        run: npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
      
      - name: Build app
        run: npm run tauri build -- --debug
      
      - name: Run tests
        env:
          CN_API_KEY: ${{ secrets.CN_API_KEY }}  # Only used on macOS
        run: npm run test:e2e
```

## Getting Help

- **CrabNebula Documentation**: https://docs.crabnebula.dev/tauri/webdriver/
- **WebdriverIO Tauri Service Docs**: See `packages/tauri-service/docs/`
- **Issues**: Report issues to the appropriate repository:
  - Driver issues: Contact CrabNebula support
  - Service integration issues: WebdriverIO desktop-mobile repo
