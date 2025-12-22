# Plan: WebKitWebDriver Detection Testing (Revised - wdio-xvfb Pattern)

**Date:** 2025-01-17 (Updated: 2025-12-20)
**Status:** ✅ Implementation Complete
**Priority:** High
**Supersedes:** webkit-detection-testing.md

## Overview

Revised implementation to match the proven wdio-xvfb testing pattern with Dockerfiles and E2E tests.

## Why Revise?

The initial approach (`webkit-detection-testing.md`) had:
- Unit tests in packages/tauri-service/test/
- CI workflows that install dependencies inline
- Separate workflows for detection vs package tests

**Problems:**
1. Less realistic - tests run in dynamic CI containers, not reproducible locally
2. Harder to maintain - setup commands scattered across YAML files
3. Not following established patterns - wdio-xvfb has a better approach

**wdio-xvfb Pattern Benefits:**
1. ✅ **Dockerfiles per distro** - Complete, reproducible environment setup
2. ✅ **Two scenarios** - Test both auto-install (`base`) and detection (`with-webkit`)
3. ✅ **E2E tests** - Real integration tests that call the actual manager code
4. ✅ **Local testability** - Can build Docker images and run tests locally
5. ✅ **Organized structure** - All test artifacts in one place (`e2e/wdio/tauri-webkit/`)

## New Structure

```
e2e/wdio/tauri-webkit/
├── docker/
│   ├── ubuntu-base.dockerfile           # WITHOUT webkit2gtk-driver
│   ├── ubuntu-with-webkit.dockerfile    # WITH webkit2gtk-driver
│   ├── fedora-base.dockerfile
│   ├── fedora-with-webkit.dockerfile
│   ├── debian-base.dockerfile
│   ├── debian-with-webkit.dockerfile
│   ├── centos-stream-base.dockerfile
│   ├── centos-stream-with-webkit.dockerfile
│   ├── arch-base.dockerfile
│   ├── arch-with-webkit.dockerfile
│   ├── alpine-base.dockerfile
│   ├── alpine-with-webkit.dockerfile
│   ├── suse-base.dockerfile
│   ├── suse-with-webkit.dockerfile
│   ├── void-base.dockerfile
│   └── void-with-webkit.dockerfile
├── base-install.e2e.ts      # Tests auto-installation
├── existing-webkit.e2e.ts   # Tests detection of pre-installed
└── wdio.conf.ts
```

## Dockerfile Pattern

Each `*-base.dockerfile`:
- Installs Node.js, pnpm, Rust
- Installs Tauri dependencies (webkit2gtk libs)
- **REMOVES** webkit2gtk-driver if present
- Verifies WebKitWebDriver is NOT available
- Creates testuser with sudo access

Each `*-with-webkit.dockerfile`:
- Same as base BUT
- **INSTALLS** webkit2gtk-driver
- Verifies WebKitWebDriver IS available

## Test Files

### base-install.e2e.ts
Tests the auto-installation flow:
1. Detects package manager correctly
2. Provides correct install command
3. Initially doesn't find WebKitWebDriver (base image)
4. Installs using detected command (real sudo installation)
5. Verifies WebKitWebDriver works after installation

### existing-webkit.e2e.ts
Tests the detection flow:
1. Detects package manager correctly
2. Finds pre-installed WebKitWebDriver
3. Returns correct path (PATH or common locations)
4. Verifies WebKitWebDriver is executable
5. Doesn't require installation instructions

## Workflow Pattern

Following wdio-xvfb's `.github/workflows/test-xvfb-e2e.yml`:

```yaml
name: Tauri WebKit Detection E2E Tests

on:
  pull_request:
    paths:
      - 'packages/tauri-service/src/driverManager.ts'
      - 'e2e/wdio/tauri-webkit/**'
  workflow_dispatch:

jobs:
  webkit-e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        include:
          # Ubuntu scenarios
          - distro: ubuntu
            version: "24.04"
            scenario: base
            dockerfile: ubuntu-base.dockerfile
          - distro: ubuntu
            version: "24.04"
            scenario: with-webkit
            dockerfile: ubuntu-with-webkit.dockerfile
          # Fedora scenarios
          - distro: fedora
            version: "40"
            scenario: base
            dockerfile: fedora-base.dockerfile
          - distro: fedora
            version: "40"
            scenario: with-webkit
            dockerfile: fedora-with-webkit.dockerfile
          # ... (8 distros × 2 scenarios = 16 test runs)

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build test container
        run: |
          docker build \
            -f e2e/wdio/tauri-webkit/docker/${{ matrix.dockerfile }} \
            -t webkit-test:${{ matrix.distro }}-${{ matrix.scenario }} \
            e2e/wdio/tauri-webkit/docker/

      - name: Run tests in container
        run: |
          docker run --rm \
            -v ${{ github.workspace }}:/workspace \
            -w /workspace \
            webkit-test:${{ matrix.distro }}-${{ matrix.scenario }} \
            bash -c "
              pnpm install --frozen-lockfile
              cd e2e/wdio/tauri-webkit
              if [ '${{ matrix.scenario }}' = 'base' ]; then
                pnpm wdio run ./wdio.conf.ts --spec base-install.e2e.ts
              else
                pnpm wdio run ./wdio.conf.ts --spec existing-webkit.e2e.ts
              fi
            "
```

## Comparison

### Old Approach (Current)
| Aspect | Implementation |
|--------|----------------|
| Structure | Unit tests in packages/tauri-service/test/ |
| Environment | Inline apt-get/dnf commands in CI |
| Reproducibility | Hard to test locally |
| Coverage | Detection functions only |
| Pattern | Custom |

### New Approach (Revised)
| Aspect | Implementation |
|--------|----------------|
| Structure | E2E tests in e2e/wdio/tauri-webkit/ |
| Environment | Dockerfiles (one per distro × scenario) |
| Reproducibility | Build & run Docker images locally |
| Coverage | End-to-end manager integration |
| Pattern | Matches wdio-xvfb (proven) |

## Implementation Steps

1. ✅ Create directory structure: `e2e/wdio/tauri-webkit/docker/`
2. ✅ Create sample Dockerfiles (Ubuntu, Fedora base/with-webkit)
3. ✅ Create E2E test files (base-install.e2e.ts, existing-webkit.e2e.ts)
4. ✅ Create wdio.conf.ts for tests
5. ✅ Create remaining Dockerfiles (Debian, CentOS, Arch, Alpine, SUSE, Void)
6. ✅ Create workflow file matching xvfb pattern
7. ✅ Add package.json with npm scripts for running tests
8. ⏸️ Remove old approach files (needs decision)
9. ✅ Update documentation

## Next Steps (Discussion Needed)

**Should we:**

1. **Complete the new approach?**
   - Create all 16 Dockerfiles (8 distros × 2 scenarios)
   - Create the workflow file
   - Remove old unit test approach

2. **Hybrid approach?**
   - Keep unit tests for quick feedback (packages/tauri-service/test/)
   - Add Docker E2E tests for comprehensive validation
   - Both serve different purposes

3. **Cost consideration**
   - New approach: 16 test runs (8 distros × 2 scenarios)
   - Old approach: 8 test runs (8 distros, one scenario)
   - Tradeoff: More thorough vs higher cost

## Recommendation

**Use the new wdio-xvfb pattern** because:
1. ✅ Proven approach already in use by WebdriverIO
2. ✅ More maintainable (Dockerfiles easier to update than YAML commands)
3. ✅ Locally testable (developers can reproduce issues)
4. ✅ More realistic (full E2E vs just unit tests)
5. ✅ Better organized (all test artifacts in one place)

The cost increase (16 vs 8 runs) is justified by:
- Testing both scenarios (auto-install AND detection)
- Catching more issues before release
- Following established WebdriverIO patterns

## Migration Plan

**Status: Implementation Complete ✅**

Completed:
1. ✅ Created all 16 Dockerfiles (8 distros × 2 scenarios):
   - Ubuntu 24.04 (base + with-webkit)
   - Fedora 40 (base + with-webkit)
   - Debian 12 (base + with-webkit)
   - CentOS Stream 9 (base + with-webkit)
   - Arch Linux (base + with-webkit)
   - Alpine Linux (base + with-webkit)
   - openSUSE Tumbleweed (base + with-webkit)
   - Void Linux (base + with-webkit)
2. ✅ Created workflow file: `.github/workflows/test-tauri-webkit-e2e.yml`
3. ✅ Created package.json with scripts for local testing
4. ✅ Added to CI via workflow file

Next steps:
- Test locally with `docker build` + `docker run` using provided npm scripts
- Run workflow manually via workflow_dispatch to validate
- Decide whether to remove old approach files or keep both
- Update main plan document once validated

## Files Created

### Dockerfiles (16 total)
- `e2e/wdio/tauri-webkit/docker/ubuntu-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/ubuntu-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/fedora-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/fedora-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/debian-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/debian-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/centos-stream-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/centos-stream-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/arch-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/arch-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/alpine-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/alpine-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/suse-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/suse-with-webkit.dockerfile`
- `e2e/wdio/tauri-webkit/docker/void-base.dockerfile`
- `e2e/wdio/tauri-webkit/docker/void-with-webkit.dockerfile`

### Test Files
- `e2e/wdio/tauri-webkit/base-install.e2e.ts`
- `e2e/wdio/tauri-webkit/existing-webkit.e2e.ts`
- `e2e/wdio/tauri-webkit/wdio.conf.ts`
- `e2e/wdio/tauri-webkit/package.json`

### CI Workflow
- `.github/workflows/test-tauri-webkit-e2e.yml`

## Local Testing

You can now test the implementation locally:

```bash
# Build Docker images
cd e2e/wdio/tauri-webkit
pnpm docker:build:ubuntu-base
pnpm docker:build:ubuntu-with

# Run tests in containers
pnpm docker:test:ubuntu-base    # Tests auto-installation
pnpm docker:test:ubuntu-with    # Tests detection

# Or build all images at once
pnpm docker:build:all
```

## Open Questions

1. Should we keep the unit tests in `packages/tauri-service/test/driver-detection.test.ts`?
   - **Pro:** Fast feedback for developers
   - **Con:** Redundant with E2E tests
   - **Recommendation:** Keep both - unit tests for quick feedback, E2E for comprehensive validation

2. Should we remove the old workflow files?
   - `packages/tauri-service/test/driver-detection.test.ts` (unit tests)
   - `.github/workflows/test-webkit-detection.yml` (old workflow)
   - `.github/workflows/_ci-package-linux-distros.reusable.yml` (old reusable workflow)
   - **Recommendation:** Remove after validating new approach works in CI

3. Should this workflow run on every PR or just when relevant files change?
   - **Implemented:** Path filters trigger on changes to driverManager.ts or webkit test files
