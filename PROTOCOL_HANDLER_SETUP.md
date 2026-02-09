# Protocol Handler Setup for Local E2E Testing

## Overview
Add Turborepo-based protocol handler installation as a prerequisite for running E2E tests locally. Works for both Electron and Tauri, with idempotency checks and PowerShell availability detection.

## Files to Create/Modify

### New Files
- `fixtures/e2e-apps/tauri/scripts/setup-protocol-handler.sh` - Tauri Linux protocol registration
- `fixtures/e2e-apps/tauri/scripts/setup-protocol-handler.ps1` - Tauri Windows protocol registration
- `fixtures/e2e-apps/tauri/scripts/protocol-install.sh` - Cross-platform wrapper (detects OS)
- `fixtures/e2e-apps/electron-builder/scripts/protocol-install.sh` - Electron Builder wrapper
- `fixtures/e2e-apps/electron-forge/scripts/protocol-install.sh` - Electron Forge wrapper
- `PROTOCOL_HANDLER_SETUP.md` - This plan document

### Modified Files
- `fixtures/e2e-apps/electron-builder/scripts/setup-protocol-handler.sh` - Add idempotency check
- `fixtures/e2e-apps/electron-builder/scripts/setup-protocol-handler.ps1` - Add idempotency + PowerShell check
- `fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.sh` - Add idempotency check
- `fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.ps1` - Add idempotency + PowerShell check
- `e2e/package.json` - Add `protocol-install` scripts for both apps
- `turbo.json` - Add `protocol-install` to `dependsOn` for all E2E tests
- `package.json` - Add convenience scripts

## Implementation Details

### 1. Tauri Protocol Install Wrapper
Detects platform and runs appropriate setup script. Includes PowerShell availability check for Windows.

### 2. Electron Protocol Install Wrapper
Same approach as Tauri wrapper, but for Electron apps.

### 3. Idempotency Checks
All setup scripts check if protocol is already registered and skip if so.

### 4. Turborepo Integration
Add `protocol-install` as a dependency to E2E test tasks in turbo.json.

### 5. Convenience Scripts
Root package.json scripts that run protocol-install before tests.

## Usage

```bash
# From root - just works!
pnpm e2e:tauri-basic
pnpm e2e:electron-builder

# From e2e directory
pnpm -C e2e test:e2e:tauri-basic

# Protocol-only
pnpm protocol-install:tauri
pnpm protocol-install:electron-builder
```

## Idempotency

Running any script multiple times is safe - it checks if protocol is already registered and skips if so.
