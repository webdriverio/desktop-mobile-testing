# Plan: Automatic Driver Management for Tauri Service

**Date:** 2025-01-XX
**Status:** Draft
**Priority:** High

## Overview

Implement automatic download, installation, and management of `tauri-driver` and platform-specific native drivers (WebKitWebDriver on Linux, msedgedriver on Windows) within the Tauri service, similar to how WebDriverIO manages Chromedriver.

## Goals

1. **Automatic `tauri-driver` installation** - Check for `tauri-driver` in PATH, optionally install via `cargo` if missing
2. **WebKitWebDriver detection** - Better detection and helpful error messages for Linux
3. **Configuration options** - Allow users to opt-in to auto-installation or provide custom paths
4. **Caching** - Cache installed binaries to avoid repeated installations
5. **Error handling** - Clear error messages with installation instructions when auto-install fails

## Architecture

### Current Flow
```
User config → onPrepare → getTauriDriverPath() → startTauriDriver()
                                      ↓
                            Throws error if not found
```

### New Flow
```
User config → onPrepare → ensureTauriDriver() → check/install → getTauriDriverPath() → startTauriDriver()
                                      ↓
                            Auto-install if enabled + cargo available
                            OR provide helpful error message
```

## Implementation Details

### 1. New Type Definitions

**File: `packages/tauri-service/src/types.ts`**

Add to `TauriServiceOptions`:
```typescript
/**
 * Automatically install tauri-driver if not found
 * Requires Rust toolchain (cargo) to be installed
 * @default false
 */
autoInstallTauriDriver?: boolean;

/**
 * Cache directory for downloaded/installed drivers
 * @default os.tmpdir() + '/wdio-tauri-drivers'
 */
driverCacheDir?: string;
```

Add to `TauriServiceGlobalOptions`:
```typescript
/**
 * Automatically install tauri-driver if not found
 * @default false
 */
autoInstallTauriDriver?: boolean;

/**
 * Cache directory for downloaded/installed drivers
 * @default os.tmpdir() + '/wdio-tauri-drivers'
 */
driverCacheDir?: string;
```

### 2. New Driver Management Module

**File: `packages/tauri-service/src/driverManager.ts`** (new file)

Key functions:
- `isCargoAvailable()` - Check if Rust toolchain is installed
- `findTauriDriver()` - Search PATH and common installation paths
- `installTauriDriver()` - Install via `cargo install tauri-driver`
- `ensureTauriDriver()` - Main function that checks/installs as needed
- `ensureWebKitWebDriver()` - Better detection with package manager-specific install instructions

### 3. Update `pathResolver.ts`

Replace `getTauriDriverPath()` to use the new driver manager (deprecated but functional for backward compatibility).

### 4. Update `launcher.ts`

Update `onPrepare` to:
- Call `ensureTauriDriver()` with merged options
- Check WebKitWebDriver on Linux with helpful error messages
- Update `startTauriDriver()` and `startTauriDriverForInstance()` to use driver manager

### 5. Update Documentation

Update `README.md` with:
- Auto-installation instructions
- Configuration options
- Manual installation fallback
- Platform-specific WebDriver requirements

### 6. Testing Strategy

**Unit Tests:**
- Test all driver manager functions
- Mock `execSync` and `spawn` for cargo operations
- Test error scenarios

**E2E Tests:**
- Test with pre-installed drivers
- Test auto-installation (if cargo available)
- Test error messages

### 7. Error Messages

Clear, actionable error messages with installation instructions.

### 8. Dependencies

No new npm dependencies required. Uses Node.js built-ins.

### 9. Migration Path

**Backward Compatible:**
- Existing code continues to work (auto-install defaults to `false`)
- `getTauriDriverPath()` still works (deprecated but functional)
- Custom paths via `tauriDriverPath` option still work

## Implementation Order

1. ✅ Create `driverManager.ts` module with core functions
2. ✅ Add type definitions to `types.ts`
3. ✅ Update `pathResolver.ts` to use driver manager
4. ✅ Update `launcher.ts` to use driver manager in `onPrepare` and `startTauriDriver`
5. ✅ Write unit tests for driver manager
6. ✅ Update documentation
7. ✅ Write E2E tests
8. ✅ Test on Windows and Linux
9. ✅ Update CI workflows if needed

## Future Enhancements

1. **Pre-built binary downloads**: Download pre-built `tauri-driver` binaries from GitHub releases instead of compiling via cargo (faster)
2. **WebKitWebDriver auto-install**: Attempt to install via package manager (requires sudo, risky but could be opt-in)
3. **Version management**: Check for `tauri-driver` version compatibility
4. **Progress indicators**: Better progress feedback during cargo install

