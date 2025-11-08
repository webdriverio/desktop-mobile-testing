<!-- 2485345b-5363-4348-87c0-18555eaeaed2 f12d669e-d2ab-4fd2-a1ea-16a379cf109f -->
# Simplify E2E Fixtures and Add CJS/ESM Package Tests

## Overview

Currently, we maintain 6 E2E apps (builder/forge/no-binary × cjs/esm) and 3 package test fixtures (all ESM). This plan simplifies by:
- **E2E apps**: Keep only ESM versions (3 apps total: `electron-builder`, `electron-forge`, `electron-no-binary`)
- **Package test fixtures**: Add CJS variants (6 fixtures total: builder/forge/script × cjs/esm)

This aligns with the principle that ESM/CJS issues are caught early during service startup, making package tests the appropriate place for module system validation.

## Changes Required

### 1. E2E App Fixtures

**Remove CJS E2E apps:**
- `fixtures/e2e-apps/electron-builder-cjs/` → Delete
- `fixtures/e2e-apps/electron-forge-cjs/` → Delete
- `fixtures/e2e-apps/electron-no-binary-cjs/` → Delete

**Rename ESM E2E apps (remove `-esm` suffix):**
- `fixtures/e2e-apps/electron-builder-esm/` → `fixtures/e2e-apps/electron-builder/`
- `fixtures/e2e-apps/electron-forge-esm/` → `fixtures/e2e-apps/electron-forge/`
- `fixtures/e2e-apps/electron-no-binary-esm/` → `fixtures/e2e-apps/electron-no-binary/`

**Update E2E app package.json files:**
- Remove `-esm` suffix from package names
- Update product names and app IDs to remove `-esm` suffix
- Files: `electron-builder/package.json`, `electron-forge/package.json`, `electron-no-binary/package.json`

### 2. Package Test Fixtures

**Create CJS variants of existing package test fixtures:**

**electron-builder-app:**
- Copy `fixtures/package-tests/electron-builder-app/` → `fixtures/package-tests/electron-builder-app-cjs/`
- Copy `fixtures/package-tests/electron-builder-app/` → `fixtures/package-tests/electron-builder-app-esm/`
- Update `electron-builder-app-cjs/package.json`: Set `"type": "commonjs"`, update name
- Update `electron-builder-app-esm/package.json`: Ensure `"type": "module"`, update name
- Update preload files: CJS version uses `.ts`, ESM version uses `.cts` (if needed)

**electron-forge-app:**
- Copy `fixtures/package-tests/electron-forge-app/` → `fixtures/package-tests/electron-forge-app-cjs/`
- Copy `fixtures/package-tests/electron-forge-app/` → `fixtures/package-tests/electron-forge-app-esm/`
- Update package.json files similarly

**electron-script-app:**
- Copy `fixtures/package-tests/electron-script-app/` → `fixtures/package-tests/electron-script-app-cjs/`
- Copy `fixtures/package-tests/electron-script-app/` → `fixtures/package-tests/electron-script-app-esm/`
- Update package.json files similarly

**Remove original fixtures:**
- Delete `fixtures/package-tests/electron-builder-app/`
- Delete `fixtures/package-tests/electron-forge-app/`
- Delete `fixtures/package-tests/electron-script-app/`

### 3. Update E2E Test Infrastructure

**`e2e/lib/utils.ts`:**
- Update `getE2EAppDirName()` function to remove `moduleType` parameter for Electron apps
- Change signature: `getE2EAppDirName(framework, app, isNoBinary)` (remove `moduleType`)
- Update implementation to return `electron-${app}` or `electron-no-binary` (no module suffix)

**`e2e/scripts/run-matrix.ts`:**
- Remove `moduleType` from `TestVariant` interface for Electron (keep for Tauri if needed)
- Update `generateTestVariants()` to only generate ESM variants for Electron apps
- Remove `moduleType` filtering logic for Electron
- Update `runTest()` to not pass `MODULE_TYPE` env var for Electron apps
- Update `getTestName()` to not include module type for Electron

**`e2e/config/envSchema.ts`:**
- Make `MODULE_TYPE` optional or remove it for Electron E2E tests
- Update `EnvironmentContext` to handle module type only for package tests

**`e2e/scripts/build-apps.ts`:**
- Remove module type handling for E2E apps
- Update app directory resolution logic

**`e2e/package.json`:**
- Remove CJS/ESM-specific test scripts (e.g., `test:e2e:electron-builder-cjs`, `test:e2e:electron-builder-esm`)
- Update scripts to remove `MODULE_TYPE` env vars for Electron E2E tests
- Keep scripts simple: `test:e2e:electron-builder`, `test:e2e:electron-forge`, `test:e2e:electron-no-binary`

### 4. Update Package Test Script

**`scripts/test-package.ts`:**
- Add logic to detect and handle CJS/ESM variants
- Update package discovery to find `*-cjs` and `*-esm` variants
- Add `--module-type` flag to filter by module type
- Update package name resolution to handle suffixes
- Ensure both CJS and ESM variants are tested by default

### 5. Update CI Workflows

**`.github/workflows/ci.yml`:**
- Remove `type: ['esm', 'cjs', '*']` from E2E matrix
- Update matrix to only include `scenario: ['builder', 'forge', 'no-binary']`
- Remove `type` parameter from `_ci-e2e.reusable.yml` call
- Update job names to remove module type references

**`.github/workflows/_ci-e2e.reusable.yml`:**
- Remove `type` input parameter
- Remove module type from test execution
- Update step names to remove module type references

**Add package test matrix (if not exists):**
- Create matrix for package tests with CJS/ESM variants
- Or update existing package test workflow to test both variants

### 6. Update Documentation

**`e2e/README.md`:**
- Remove references to `MODULE_TYPE` for E2E tests
- Update examples to remove module type flags
- Clarify that E2E tests use ESM only

**`fixtures/e2e-apps/README.md`:**
- Update to reflect new naming (no `-esm` suffix)
- Remove CJS app references

**`fixtures/package-tests/README.md`:**
- Document CJS/ESM variants
- Explain when to use each variant

## Migration Steps

1. **Create CJS/ESM package test fixtures** (before removing E2E apps)
2. **Update package test script** to handle variants
3. **Rename ESM E2E apps** (remove `-esm` suffix)
4. **Update E2E test infrastructure** (remove module type handling)
5. **Update CI workflows** (remove E2E module type matrix)
6. **Delete CJS E2E apps**
7. **Update documentation**
8. **Test both package test variants and E2E tests**

## Verification

- Package tests run for both CJS and ESM variants
- E2E tests run without module type specification
- CI workflows pass with simplified matrix
- All test scripts work correctly
- Documentation is accurate

### To-dos

- [ ] Create CJS and ESM variants of package test fixtures (builder, forge, script) and update their package.json files
- [ ] Update scripts/test-package.ts to handle CJS/ESM variants and add --module-type flag
- [ ] Rename ESM E2E apps to remove -esm suffix and update their package.json files
- [ ] Update e2e/lib/utils.ts getE2EAppDirName() to remove moduleType parameter
- [ ] Update e2e/scripts/run-matrix.ts to remove moduleType from TestVariant and test generation logic
- [ ] Update e2e/config/envSchema.ts to make MODULE_TYPE optional for E2E tests
- [ ] Update e2e/package.json scripts to remove MODULE_TYPE and CJS/ESM-specific variants
- [ ] Update .github/workflows/ci.yml and _ci-e2e.reusable.yml to remove module type matrix for E2E tests
- [ ] Delete CJS E2E app fixtures (electron-builder-cjs, electron-forge-cjs, electron-no-binary-cjs)
- [ ] Update README files in e2e/, fixtures/e2e-apps/, and fixtures/package-tests/ to reflect changes