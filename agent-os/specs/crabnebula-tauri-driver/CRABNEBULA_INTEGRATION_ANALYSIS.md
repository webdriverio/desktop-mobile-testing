# CrabNebula Tauri Driver Integration Analysis

## Executive Summary

This document analyzes the feasibility of integrating CrabNebula's `@crabnebula/tauri-driver` into the `@wdio/tauri-service` to enable macOS testing support. CrabNebula provides a fork of the official tauri-driver with macOS support via a proprietary WebDriver implementation.

## Current State Analysis

### Tauri Service Architecture

The current `@wdio/tauri-service` implementation:

1. **Launcher Service** ([`launcher.ts`](packages/tauri-service/src/launcher.ts:1)):
   - Manages tauri-driver process lifecycle
   - Handles platform-specific driver detection (Windows: msedgedriver, Linux: webkit2gtk-driver)
   - Explicitly **blocks macOS** with an error message (lines 173-180)
   - Supports per-worker and multiremote modes
   - Auto-installs official tauri-driver via cargo

2. **Driver Manager** ([`driverManager.ts`](packages/tauri-service/src/driverManager.ts:1)):
   - Finds or installs official `tauri-driver` from crates.io
   - Uses cargo install for automatic installation
   - No support for npm-based driver packages

3. **Types** ([`native-types/src/tauri.ts`](packages/native-types/src/tauri.ts:1)):
   - Defines service options and capabilities
   - No CrabNebula-specific configuration options

4. **Platform Support** ([`docs/platform-support.md`](packages/tauri-service/docs/platform-support.md:1)):
   - Documents macOS as unsupported due to WKWebView limitations
   - Windows: msedgedriver auto-management
   - Linux: webkit2gtk-driver manual installation

### CrabNebula Requirements Analysis

Based on the documentation provided:

#### 1. NPM Package Distribution
- `@crabnebula/tauri-driver` - Main driver package (npm-based, not cargo)
- `@crabnebula/test-runner-backend` - Required for local macOS testing
- `@crabnebula/webdriverio-cloud-reporter` - Optional cloud reporter

#### 2. macOS Prerequisites
- **tauri-plugin-automation** must be installed in the Tauri app
- Plugin must be conditionally compiled (debug builds only)
- **CN_API_KEY** environment variable required for macOS tests

#### 3. Architecture Differences

| Aspect | Official tauri-driver | CrabNebula tauri-driver |
|--------|----------------------|-------------------------|
| Distribution | Cargo (crates.io) | NPM (@crabnebula) |
| macOS Support | ❌ No | ✅ Yes (via subscription) |
| Linux Support | ✅ webkit2gtk-driver | ✅ webkit2gtk-driver |
| Windows Support | ✅ msedgedriver | ✅ msedgedriver |
| Backend Service | None | test-runner-backend (macOS) |
| API Key Required | No | Yes (CN_API_KEY for macOS) |

#### 4. Configuration Complexity

CrabNebula requires significantly more setup:

```javascript
// CrabNebula wdio.conf.js structure
exports.config = {
  onPrepare: async () => {
    // Build the app
    spawnSync("pnpm", ["tauri", "build", "--debug", "--no-bundle"]);
    
    if (process.platform === "darwin") {
      // Validate API key
      if (!process.env.CN_API_KEY) {
        console.error("CN_API_KEY is not set");
        process.exit(1);
      }
      
      // Start test-runner-backend
      testRunnerBackend = spawn("pnpm", ["test-runner-backend"]);
      await waitTestRunnerBackendReady();
      
      // Set remote WebDriver URL
      process.env.REMOTE_WEBDRIVER_URL = `http://127.0.0.1:3000`;
    }
  },
  
  beforeSession: async () => {
    // Start tauri-driver
    tauriDriver = spawn("pnpm", ["tauri-driver"]);
    await waitTauriDriverReady();
  }
};
```

## Integration Points & Required Changes

### 1. Driver Detection & Installation

**Current**: [`driverManager.ts`](packages/tauri-service/src/driverManager.ts:34) searches for cargo-installed binary

**Required Changes**:
- Add detection for `@crabnebula/tauri-driver` in node_modules/.bin
- Support npm-based driver execution (npx/pnpm style)
- Maintain backward compatibility with official driver

### 2. macOS Platform Support

**Current**: [`launcher.ts`](packages/tauri-service/src/launcher.ts:173) explicitly throws error on macOS

**Required Changes**:
- Conditionally allow macOS when CrabNebula driver is configured
- Add validation for tauri-plugin-automation presence
- Check CN_API_KEY environment variable

### 3. Test Runner Backend Management (macOS only)

**Current**: No backend service management

**Required Changes**:
- Add `@crabnebula/test-runner-backend` process management
- Implement `waitTestRunnerBackendReady()` functionality
- Handle REMOTE_WEBDRIVER_URL environment variable
- Lifecycle management (start before driver, stop on complete)

### 4. Configuration Schema

**Current**: [`TauriServiceOptions`](packages/native-types/src/tauri.ts:139)

**Proposed Additions**:
```typescript
interface TauriServiceOptions {
  // Existing options...
  
  // CrabNebula-specific options
  driverProvider?: 'official' | 'crabnebula';
  crabnebulaApiKey?: string; // Or use CN_API_KEY env var
  crabnebulaTestRunnerBackend?: boolean; // Auto-manage backend
}
```

### 5. Plugin Validation

**New Requirement**: Verify tauri-plugin-automation is installed for macOS builds

**Implementation Options**:
- Parse Cargo.toml for plugin dependency
- Check compiled binary for automation symbols
- Runtime detection (attempt connection and report meaningful error)

### 6. Documentation Updates

Files requiring updates:
- [`docs/platform-support.md`](packages/tauri-service/docs/platform-support.md:11) - Update macOS status
- [`docs/configuration.md`](packages/tauri-service/docs/configuration.md:1) - Add CrabNebula options
- New doc: `docs/crabnebula-setup.md` - Complete setup guide

## Feasibility Assessment

### ✅ High Feasibility Items

1. **Driver Detection**: Straightforward to add npm binary detection alongside cargo
2. **Configuration Options**: Simple type additions to existing interfaces
3. **Documentation**: Clear path for updates
4. **Windows/Linux**: CrabNebula supports these platforms with same drivers as official

### ⚠️ Medium Complexity Items

1. **Backend Process Management**: Requires new process lifecycle management similar to tauri-driver
2. **macOS Platform Enablement**: Need to carefully conditionalize the platform check
3. **API Key Handling**: Secure handling of CN_API_KEY (env var vs config)

### 🔴 High Complexity / Blockers

1. **Plugin Validation**: Detecting tauri-plugin-automation requires build-time or binary analysis
2. **OSS License Dependency**: Testing requires CrabNebula subscription/OSS license
3. **Conditional Compilation**: Users must properly configure debug-only plugin inclusion

## Implementation Recommendations

### Phase 1: Foundation (Minimal Viable Support)

1. **Add driver provider selection**:
   ```typescript
   services: [['@wdio/tauri-service', {
     driverProvider: 'crabnebula', // 'official' | 'crabnebula'
   }]]
   ```

2. **Update driver detection** in [`driverManager.ts`](packages/tauri-service/src/driverManager.ts:34):
   - Check for `@crabnebula/tauri-driver` in node_modules
   - Fall back to npx execution

3. **Conditional macOS support** in [`launcher.ts`](packages/tauri-service/src/launcher.ts:173):
   - Only throw error if `driverProvider !== 'crabnebula'`

### Phase 2: macOS Backend Support

1. **Add test-runner-backend management**:
   - New module: `crabnebulaBackend.ts`
   - Process lifecycle similar to tauri-driver
   - Port readiness checking

2. **Environment variable handling**:
   - REMOTE_WEBDRIVER_URL injection
   - CN_API_KEY validation

### Phase 3: Developer Experience

1. **Plugin validation**:
   - Cargo.toml parsing helper
   - Pre-test validation warnings

2. **Documentation**:
   - Complete setup guide
   - Troubleshooting section
   - CI/CD examples

## OSS License Considerations

To enable testing and CI for this repository:

1. **Request OSS License** from CrabNebula for the tauri-service repo
2. **Test Strategy**:
   - Unit tests for driver detection (mocked)
   - Integration tests require valid CN_API_KEY
   - Consider scheduled tests vs PR tests

3. **CI Configuration**:
   ```yaml
   # GitHub Actions example
   - name: Run macOS tests
     if: secrets.CN_API_KEY != ''
     env:
       CN_API_KEY: ${{ secrets.CN_API_KEY }}
     run: pnpm test:macos
   ```

## Alternative Approaches

### Option A: Direct Integration (Recommended)
Integrate CrabNebula support directly into `@wdio/tauri-service` as outlined above.

**Pros**:
- Single service for all Tauri testing
- Seamless user experience
- Platform abstraction

**Cons**:
- Adds complexity to core service
- Requires OSS license for testing

### Option B: Separate Package
Create `@wdio/crabnebula-service` as a separate package.

**Pros**:
- Clean separation of concerns
- No OSS license needed for core service
- Optional dependency

**Cons**:
- User must choose/configure separately
- Potential code duplication
- Fragmented ecosystem

### Option C: Plugin Architecture
Make driver providers pluggable.

**Pros**:
- Extensible for future drivers
- Clean abstraction

**Cons**:
- Significant refactoring required
- Over-engineering for current needs

## Conclusion

**Integration is highly feasible** with the following key points:

1. **Architecture Compatibility**: CrabNebula follows the same WebDriver protocol as official tauri-driver
2. **Minimal Breaking Changes**: Can be added as opt-in configuration
3. **Clear Implementation Path**: Phased approach reduces risk
4. **OSS License**: Recommended to obtain for proper CI testing

**Estimated Effort**: 2-3 weeks for full implementation including:
- Code changes (1 week)
- Documentation (3-4 days)
- Testing & validation (3-4 days)

**Priority Recommendation**: Medium-High. macOS support is a significant gap in Tauri testing ecosystem that CrabNebula uniquely solves.
