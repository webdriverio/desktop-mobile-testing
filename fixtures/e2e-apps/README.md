# E2E Test Applications

This directory contains E2E test applications for demonstrating and testing the `wdio-electron-service` and `wdio-tauri-service` with different configurations.

## Application Types

### Electron Applications

- **electron-builder**: Example using Electron Builder for packaging (ESM only)
- **electron-forge**: Example using Electron Forge for packaging (ESM only)
- **electron-no-binary**: Example without packaging, direct Electron execution (ESM only)

**Note**: E2E tests use ESM only. CJS/ESM module system testing is done in package tests (see `fixtures/package-tests/`).

### Tauri Applications

- **tauri**: Example Tauri application for testing `wdio-tauri-service`

## Running Examples

After installing dependencies with PNPM, build and test any example:

```sh
cd fixtures/e2e-apps/electron-builder
pnpm build
pnpm wdio run wdio.conf.ts
```

## Testing Strategy

- **E2E tests**: Use ESM-only apps to test full application functionality
- **Package tests**: Use CJS/ESM variants to test module system compatibility (see `fixtures/package-tests/`)
