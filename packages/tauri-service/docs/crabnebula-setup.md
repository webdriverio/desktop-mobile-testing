# CrabNebula Setup Guide

This guide walks you through setting up CrabNebula's tauri-driver for macOS testing support.

## Overview

CrabNebula provides a fork of the official tauri-driver that adds macOS support via a proprietary WebDriver implementation. This enables WebdriverIO testing on macOS, which is not possible with the official driver.

## Prerequisites

Before you begin, you'll need:

1. A **CrabNebula account** with an API key (contact [CrabNebula](https://crabnebula.dev) for access)
2. A **Tauri v2 application** with the automation plugin installed
3. **Node.js 18+** and **Rust toolchain** installed

## Installation

### Step 1: Install CrabNebula Packages

Install the required npm packages as dev dependencies:

```bash
npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
```

Or with pnpm:
```bash
pnpm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
```

Or with yarn:
```bash
yarn add -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
```

### Step 2: Add Automation Plugin

The automation plugin is required for CrabNebula to control your Tauri app on macOS.

1. Navigate to your Tauri source directory:
   ```bash
   cd src-tauri
   ```

2. Add the plugin:
   ```bash
   cargo add tauri-plugin-automation
   ```

3. Register the plugin in your Rust code. **Important**: Only include this in debug builds:

   ```rust
   // src-tauri/src/lib.rs or main.rs
   
   let mut builder = tauri::Builder::default();
   
   // Only enable automation in debug builds
   #[cfg(debug_assertions)]
   {
     builder = builder.plugin(tauri_plugin_automation::init());
   }
   
   builder
     .run(tauri::generate_context!())
     .expect("error while running tauri application");
   ```

   > ⚠️ **Warning**: Never include the automation plugin in release builds, as it could allow external control of your application.

### Step 3: Set Environment Variable

Set your CrabNebula API key as an environment variable:

```bash
export CN_API_KEY="your-api-key-here"
```

For CI/CD, add this as a secret:

**GitHub Actions:**
```yaml
env:
  CN_API_KEY: ${{ secrets.CN_API_KEY }}
```

### Step 4: Configure WebdriverIO

Update your `wdio.conf.ts` to use CrabNebula:

```typescript
export const config = {
  services: [
    ['@wdio/tauri-service', {
      driverProvider: 'crabnebula',
      crabnebulaManageBackend: true,  // Auto-manage backend (default)
      crabnebulaBackendPort: 3000,     // Backend port (default)
    }]
  ],
  
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': {
      // Path to your debug binary
      application: './src-tauri/target/debug/your-app-name',
    }
  }],
  
  // ... rest of your config
};
```

### Step 5: Build Your App

Build your Tauri app in debug mode:

```bash
npm run tauri build -- --debug
```

Or with cargo directly:
```bash
cd src-tauri && cargo build
```

### Step 6: Run Tests

Now you can run your WebdriverIO tests:

```bash
npm run wdio
```

## Troubleshooting

### "CN_API_KEY is not set"

**Solution**: Ensure the environment variable is set:
```bash
echo $CN_API_KEY  # Should show your API key
```

If empty, set it:
```bash
export CN_API_KEY="your-api-key"
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

Then ensure it's registered in your Rust code with the `#[cfg(debug_assertions)]` guard.

### "test-runner-backend exited with code X"

**Possible causes**:
- Invalid or expired CN_API_KEY
- Port 3000 already in use (change `crabnebulaBackendPort`)
- macOS security restrictions

**Solutions**:
1. Verify your API key is valid
2. Change the backend port:
   ```typescript
   crabnebulaBackendPort: 3001
   ```
3. Check System Preferences > Security & Privacy for any blocked applications

### Tests work on Linux/Windows but not macOS

**Checklist**:
- [ ] CN_API_KEY is set and valid
- [ ] tauri-plugin-automation is in Cargo.toml
- [ ] Plugin is registered with `#[cfg(debug_assertions)]`
- [ ] App is built in debug mode (target/debug/)
- [ ] @crabnebula/tauri-driver is installed
- [ ] @crabnebula/test-runner-backend is installed

## CI/CD Configuration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-action@stable
      
      - name: Install dependencies
        run: |
          npm install
          npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
      
      - name: Build Tauri app
        run: npm run tauri build -- --debug
      
      - name: Run E2E tests
        env:
          CN_API_KEY: ${{ secrets.CN_API_KEY }}
        run: npm run test:e2e
```

### Conditional Testing (No API Key)

If you don't have a CN_API_KEY in certain environments (e.g., PRs from forks):

```yaml
- name: Run E2E tests
  if: env.CN_API_KEY != ''
  env:
    CN_API_KEY: ${{ secrets.CN_API_KEY }}
  run: npm run test:e2e

- name: Skip E2E tests (no API key)
  if: env.CN_API_KEY == ''
  run: echo "Skipping macOS tests - no CN_API_KEY available"
```

## Advanced Configuration

### Custom Backend Port

If port 3000 is already in use:

```typescript
services: [['@wdio/tauri-service', {
  driverProvider: 'crabnebula',
  crabnebulaBackendPort: 3001,
}]]
```

### Manual Backend Management

If you prefer to manage the backend yourself:

```typescript
services: [['@wdio/tauri-service', {
  driverProvider: 'crabnebula',
  crabnebulaManageBackend: false,  // You'll start/stop it manually
}]]
```

Then in your test setup:
```bash
# Terminal 1: Start backend
npx test-runner-backend

# Terminal 2: Run tests
export REMOTE_WEBDRIVER_URL=http://127.0.0.1:3000
npm run wdio
```

### Custom Driver Path

If the driver is not in node_modules/.bin:

```typescript
services: [['@wdio/tauri-service', {
  driverProvider: 'crabnebula',
  crabnebulaDriverPath: '/custom/path/to/tauri-driver',
}]]
```

## Getting Help

- **CrabNebula Documentation**: https://docs.crabnebula.dev/tauri/webdriver/
- **CrabNebula Support**: Contact via their website for API key and support
- **WebdriverIO Issues**: Report integration issues to the desktop-mobile repository

## Migration from Official Driver

If you're already using the official tauri-driver on Windows/Linux:

1. Keep your existing configuration for Windows/Linux
2. Add CrabNebula packages as dev dependencies
3. Add the automation plugin to your Tauri app
4. Set CN_API_KEY in your environment
5. Use conditional configuration if needed:

```typescript
const isMacOS = process.platform === 'darwin';

export const config = {
  services: [['@wdio/tauri-service', {
    driverProvider: isMacOS ? 'crabnebula' : 'official',
  }]]
};
```
