# Edge WebDriver Management for Windows

## Overview

On Windows, Tauri applications use Microsoft Edge WebView2, which requires `msedgedriver.exe` for WebDriver automation. The tauri-service automatically handles Edge WebDriver version matching to prevent version mismatch errors.

## The Problem

Tauri tests fail on Windows when your Edge browser version doesn't match the installed msedgedriver version:

```
Error: This version of Microsoft Edge WebDriver only supports Microsoft Edge version 144.
Current browser version is 143.0.3650.139
```

## The Solution

The tauri-service automatically:
1. **Detects** your Edge browser version from Windows registry
2. **Checks** if a matching msedgedriver.exe exists
3. **Downloads** the correct version if needed (enabled by default)
4. **Configures** PATH to use the downloaded driver

## Configuration

### Auto-Download (Recommended)

By default, auto-download is **enabled**. Just use the service normally:

```javascript
// wdio.conf.js
export const config = {
  services: [
    ['tauri', {
      application: './path/to/your-app.exe',
      // autoDownloadEdgeDriver: true (default)
    }]
  ]
};
```

### Manual Management

Disable auto-download if you prefer to manage drivers yourself:

```javascript
export const config = {
  services: [
    ['tauri', {
      application: './path/to/your-app.exe',
      autoDownloadEdgeDriver: false
    }]
  ]
};
```

With auto-download disabled, you must ensure msedgedriver matches your Edge version manually.

## How It Works

### 1. Version Detection

The service detects Edge version from:
- Windows Registry: `HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}`
- WMIC query: `wmic datafile where name="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" get Version`

### 2. Driver Check

Checks if msedgedriver.exe in PATH matches the detected Edge version (major version comparison).

### 3. Download & Install

If mismatch detected:
- Downloads msedgedriver from `https://msedgedriver.azureedge.net/{version}/`
- Caches in temp directory: `%TEMP%\msedgedriver\{majorVersion}\`
- Adds to process PATH for test execution

## Troubleshooting

### "Could not detect Edge version"

**Cause**: Edge not installed or registry keys missing

**Solution**: Install Microsoft Edge from https://www.microsoft.com/edge

### "Failed to download msedgedriver"

**Causes**:
- Network/proxy issues
- Microsoft's CDN temporarily unavailable
- Invalid Edge version format

**Solutions**:
1. Check internet connection and proxy settings
2. Retry - CDN may be temporarily down
3. Manual download from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
4. Place `msedgedriver.exe` in PATH

### "Version mismatch" even after download

**Cause**: Another msedgedriver.exe earlier in PATH is being used

**Solution**: Check PATH order:
```powershell
where msedgedriver.exe
```
Ensure the correct version appears first

### CI/GitHub Actions Issues

**Symptom**: Download works locally but fails in CI

**Causes**:
- GitHub Actions runners may have outdated Edge
- Network restrictions

**Solutions**:
```yaml
# .github/workflows/test.yml
- name: Update Edge (if needed)
  if: runner.os == 'Windows'
  run: |
    choco upgrade microsoft-edge -y

- name: Run tests
  run: pnpm test:e2e
```

## Platform Behavior

- **Windows**: Edge driver check runs automatically
- **Linux**: Skipped (Tauri uses WebKitGTK)
- **macOS**: N/A (Tauri testing not supported on macOS)

## API Reference

### Service Options

```typescript
interface TauriServiceOptions {
  /**
   * Automatically download and configure matching msedgedriver on Windows
   * @default true
   * @platform Windows only
   */
  autoDownloadEdgeDriver?: boolean;
}
```

### Example Configurations

#### Default (Auto-Download Enabled)
```javascript
services: [
  ['tauri', {
    application: './dist/my-app.exe'
  }]
]
```

#### Explicit Configuration
```javascript
services: [
  ['tauri', {
    application: './dist/my-app.exe',
    autoDownloadEdgeDriver: true,
    tauriDriverPort: 4444
  }]
]
```

#### Disable Auto-Download
```javascript
services: [
  ['tauri', {
    application: './dist/my-app.exe',
    autoDownloadEdgeDriver: false
  }]
]
```

## Manual Driver Management

If you disable auto-download, ensure msedgedriver matches your Edge version:

### Check Edge Version
```powershell
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}" /v pv
```

### Download Matching Driver
1. Visit https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
2. Download version matching your Edge major version
3. Extract `msedgedriver.exe`
4. Add to PATH or place in project directory

### Verify Installation
```powershell
msedgedriver.exe --version
# Should output: MSEdgeDriver 143.x.xxxx.xx
```

## Development Notes

### File Structure
- `src/edgeDriverManager.ts` - Edge driver detection and download logic
- `src/launcher.ts` - Integration point in onPrepare hook
- `src/types.ts` - TypeScript interfaces

### Cache Location
Downloaded drivers are cached at:
```
%TEMP%\msedgedriver\{majorVersion}\msedgedriver.exe
```

Example: `C:\Users\YourName\AppData\Local\Temp\msedgedriver\143\msedgedriver.exe`

### Logging
Enable debug logs to troubleshoot:
```javascript
export const config = {
  logLevel: 'debug',
  services: ['tauri']
};
```

Look for logs prefixed with `[tauri-service:edge-driver]`
