# Task Breakdown: Monorepo Foundation with Electron Service

## Overview

**Spec ID:** 20251021-monorepo-with-electron
**Roadmap Item:** #1 (Roadmap V2)
**Total Tasks:** ~90-110 tasks across 6 task groups
**Timeline:** Q1 2026, Weeks 1-5 (estimated 4-5 weeks)
**Type:** Infrastructure setup + service migration

**Source Repository:** `/Users/sam/Workspace/wdio-electron-service`

## Task Execution Strategy

### Phase Dependencies
```
Task Group 1 (Monorepo Foundation)
    ↓ Week 1
Task Group 2 (Utils Migration) → Task Group 3 (CDP Bridge Migration)
    ↓ Week 2              ↓ Week 2
Task Group 4 (Service Migration)
    ↓ Week 3
Task Group 5 (Integration & Validation)
    ↓ Week 4
Task Group 6 (CI/CD Setup)
    ↓ Week 5
```

### Parallel Execution Opportunities
- **Week 2**: Task Groups 2 and 3 can partially overlap (start TG3 after TG2 utils migrated)
- **Week 4**: Documentation tasks can run in parallel with validation
- **Week 5**: CI workflow creation can run in parallel with testing/refinement

---

## Task Groups

### Task Group 1: Monorepo Foundation (Week 1, 5-7 days)

**Dependencies:** None
**Can Start:** Immediately
**Estimated Effort:** M (Medium, 5-7 days)
**Phase:** 1 (Monorepo Scaffolding)

**Goal:** Establish basic monorepo structure and tooling foundation

#### 1.1 Repository Foundation (1 day)

- [x] **1.1.1 Initialize repository state**
  - **Effort:** S
  - **Links to:** NFR3
  - Verify git repository is clean
  - Ensure on `main` branch
  - Document starting commit hash

- [x] **1.1.2 Create root directory structure**
  - **Effort:** S
  - **Links to:** FR1, FR4
  - Create `packages/` directory
  - Create `examples/` directory
  - Create `e2e/` directory
  - Create `docs/` directory
  - Create `scripts/` directory
  - Create `.github/workflows/` directory
  - Create `.husky/` directory

- [x] **1.1.3 Create core root files**
  - **Effort:** S
  - **Links to:** TR1, NFR4
  - Create `.gitignore` (node_modules, dist, .turbo, coverage)
  - Create `.npmrc` with pnpm configuration
  - Create `LICENSE` file (MIT)
  - Create basic root `README.md`

#### 1.2 Package Manager Setup (1 day)

- [x] **1.2.1 Configure pnpm workspace**
  - **Effort:** M
  - **Links to:** FR1, TR1
  - Create `pnpm-workspace.yaml`:
    ```yaml
    packages:
      - 'packages/**'
      - 'examples/**'
      - 'e2e/**'
    ```
  - Configure `.npmrc`:
    ```
    enable-pre-post-scripts=true
    auto-install-peers=false
    strict-peer-dependencies=false
    ```
  - Set packageManager in root package.json
  - Run `pnpm install` to verify workspace

- [x] **1.2.2 Set up dependency catalog (optional)**
  - **Effort:** S
  - **Links to:** TR1, NFR5
  - Create pnpm catalog in `pnpm-workspace.yaml`
  - Define common dependency versions
  - Document catalog usage pattern

- [x] **1.2.3 Create root package.json**
  - **Effort:** M
  - **Links to:** FR1, TR1
  - Set up workspace scripts
  - Configure package manager field
  - Add root devDependencies (Turborepo, TypeScript, Biome, ESLint, Vitest)
  - Define engines field (Node 18/20)

#### 1.3 Turborepo Configuration (1 day)

- [x] **1.3.1 Install and configure Turborepo**
  - **Effort:** M
  - **Links to:** FR2, NFR2
  - Install `turbo` package
  - Create `turbo.json` with pipeline:
    ```json
    {
      "pipeline": {
        "build": {
          "dependsOn": ["^build"],
          "outputs": ["dist/**"]
        },
        "test": {
          "dependsOn": ["build"],
          "outputs": ["coverage/**"]
        },
        "lint": {},
        "typecheck": {
          "dependsOn": ["^build"]
        }
      }
    }
    ```
  - Configure cache options
  - Test pipeline execution

- [x] **1.3.2 Configure Turborepo caching**
  - **Effort:** S
  - **Links to:** NFR2
  - Set up local caching (.turbo/)
  - Configure remote caching (optional)
  - Document cache behavior

#### 1.4 TypeScript Configuration (1 day)

- [x] **1.4.1 Create base TypeScript configs**
  - **Effort:** M
  - **Links to:** FR3, TR5
  - Create `tsconfig.base.json` (ESM):
    ```json
    {
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "strict": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true,
        "outDir": "./dist/esm"
      }
    }
    ```
  - Create `tsconfig.base.cjs.json` (CJS):
    ```json
    {
      "extends": "./tsconfig.base.json",
      "compilerOptions": {
        "module": "CommonJS",
        "moduleResolution": "Node",
        "outDir": "./dist/cjs"
      }
    }
    ```

- [x] **1.4.2 Set up shared type definitions**
  - **Effort:** S
  - **Links to:** FR3
  - Create `types/` directory in root
  - Add global type definitions if needed
  - Configure path aliases

#### 1.5 Code Quality Tools (1 day)

- [x] **1.5.1 Configure Biome**
  - **Effort:** M
  - **Links to:** TR2, NFR4
  - Install Biome
  - Create `biome.json`:
    ```json
    {
      "formatter": {
        "enabled": true,
        "indentStyle": "space",
        "indentWidth": 2
      },
      "linter": {
        "enabled": true,
        "rules": {
          "recommended": true
        }
      }
    }
    ```
  - Test formatting and linting

- [x] **1.5.2 Configure ESLint**
  - **Effort:** M
  - **Links to:** TR2, NFR4
  - Install ESLint and plugins
  - Create `eslint.config.js`:
    - @typescript-eslint/parser
    - @vitest/eslint-plugin
    - eslint-plugin-wdio
  - Configure rules for TypeScript
  - Test linting

- [x] **1.5.3 Set up pre-commit hooks**
  - **Effort:** M
  - **Links to:** TR2, NFR3
  - Install Husky
  - Install lint-staged
  - Create `.husky/pre-commit` hook
  - Configure lint-staged in package.json:
    ```json
    {
      "lint-staged": {
        "*.{ts,js}": ["biome format --write", "eslint --fix"]
      }
    }
    ```
  - Test hook execution

#### 1.6 Testing Framework (1 day)

- [x] **1.6.1 Configure Vitest**
  - **Effort:** M
  - **Links to:** TR3, FR7
  - Install Vitest and dependencies
  - Create shared `vitest.config.ts`:
    ```typescript
    export default defineConfig({
      test: {
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
          threshold: {
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80
          }
        }
      }
    })
    ```
  - Install jsdom for DOM testing
  - Test Vitest execution

#### 1.7 Package Structure Template (1 day)

- [x] **1.7.1 Create package structure template**
  - **Effort:** M
  - **Links to:** FR4
  - Document standard package structure
  - Create package.json template
  - Define build scripts pattern
  - Document exports pattern (ESM/CJS)

- [x] **1.7.2 Create example scaffold package**
  - **Effort:** M
  - **Links to:** FR4, NFR3
  - Create `packages/@wdio/electron-service/` as template
  - Implement minimal TypeScript code
  - Add basic tests
  - Verify builds (ESM + CJS)
  - Verify Turborepo integration

#### 1.8 Documentation (ongoing)

- [x] **1.8.1 Create monorepo setup documentation**
  - **Effort:** M
  - **Links to:** FR11, NFR3
  - Document setup instructions
  - Document development workflow
  - Document build commands
  - Document testing approach

- [x] **1.8.2 Document package structure conventions**
  - **Effort:** M
  - **Links to:** FR4, FR11
  - Write `docs/package-structure.md`
  - Document naming conventions
  - Document required package.json fields
  - Document build patterns

- [x] **1.8.3 Create contribution guidelines**
  - **Effort:** M
  - **Links to:** FR11, NFR3
  - Write `CONTRIBUTING.md`
  - Document Git workflow
  - Document commit message conventions
  - Document PR process
  - Document coding standards

---

### Task Group 2: Electron Utils Migration (Week 2, 5-7 days)

**Dependencies:** Task Group 1 complete
**Can Start:** After Week 1
**Estimated Effort:** M (Medium, 5-7 days)
**Phase:** 2 (Electron Service Migration - Week 2)

**Goal:** Migrate @wdio/electron-utils package

#### 2.1 Package Migration (@wdio/electron-utils)

- [x] **2.1.1 Copy source code**
  - **Effort:** S
  - **Links to:** FR5
  - Copy `/Users/sam/Workspace/wdio-electron-service/packages/@wdio_electron-utils/src/` to `packages/@wdio/electron-utils/src/`
  - Verify all files copied

- [x] **2.1.2 Create package.json**
  - **Effort:** M
  - **Links to:** FR5, TR1
  - Create `packages/@wdio/electron-utils/package.json`
  - Set up dual exports (ESM/CJS)
  - Configure peer dependencies (WebdriverIO 9.0+)
  - Set up build scripts
  - Use workspace protocol for dependencies

- [x] **2.1.3 Create TypeScript configs**
  - **Effort:** S
  - **Links to:** FR3
  - Create `tsconfig.json` (extends base ESM)
  - Create `tsconfig.cjs.json` (extends base CJS)

- [x] **2.1.4 Migrate tests**
  - **Effort:** M
  - **Links to:** FR7
  - Copy tests from standalone repo
  - Update test imports to workspace packages
  - Create `vitest.config.ts`
  - Run tests and verify passing

- [x] **2.1.5 Update imports (if needed)**
  - **Effort:** S
  - **Links to:** FR5
  - Update internal imports for monorepo
  - Verify no broken imports

- [x] **2.1.6 Build and validate**
  - **Effort:** M
  - **Links to:** FR5, TR4
  - Run `pnpm build`
  - Verify ESM output
  - Verify CJS output
  - Verify TypeScript declarations
  - Check exports work

#### 2.2 Testing and Validation

- [x] **2.2.1 Run package tests**
  - **Effort:** M
  - **Links to:** FR7, NFR4
  - Run `pnpm test`
  - Verify all tests pass
  - Check coverage meets 80%+ threshold

- [x] **2.2.2 Turborepo integration**
  - **Effort:** S
  - **Links to:** FR2
  - Verify `turbo build` includes package
  - Verify `turbo test` includes package
  - Verify `turbo lint` includes package
  - Test caching behavior

---

### Task Group 3: Electron CDP Bridge Migration (Week 2, 3-4 days)

**Dependencies:** Task Group 2 complete (utils package)
**Can Start:** After @wdio/electron-utils migrated
**Estimated Effort:** S-M (Small-Medium, 3-4 days)
**Phase:** 2 (Electron Service Migration - Week 2)

**Goal:** Migrate @wdio/electron-cdp-bridge package

#### 3.1 Package Migration (@wdio/electron-cdp-bridge)

- [x] **3.1.1 Copy source code**
  - **Effort:** S
  - **Links to:** FR5
  - Copy CDP bridge source to `packages/@wdio/electron-cdp-bridge/src/`

- [x] **3.1.2 Create package.json**
  - **Effort:** M
  - **Links to:** FR5, TR6
  - Create package.json with dual exports
  - Add workspace dependency on @wdio/electron-utils (`workspace:*`)
  - Configure peer dependencies

- [x] **3.1.3 Create TypeScript configs**
  - **Effort:** S
  - **Links to:** FR3
  - Create tsconfig.json (ESM)
  - Create tsconfig.cjs.json (CJS)

- [x] **3.1.4 Migrate tests**
  - **Effort:** M
  - **Links to:** FR7
  - Copy integration tests
  - Update imports to workspace packages
  - Update test configuration

- [x] **3.1.5 Build and validate**
  - **Effort:** M
  - **Links to:** FR5
  - Build package (ESM + CJS)
  - Verify TypeScript declarations
  - Test package exports

#### 3.2 Feature Validation

- [x] **3.2.1 Validate CDP connection**
  - **Effort:** M
  - **Links to:** FR6
  - Test CDP bridge connection
  - Test main process execution
  - Verify error handling

- [x] **3.2.2 Run tests and verify coverage**
  - **Effort:** M
  - **Links to:** FR7
  - Run all tests
  - Verify 80%+ coverage
  - Check Turborepo integration

---

### Task Group 4: Electron Service Migration (Week 3, 5-7 days)

**Dependencies:** Task Groups 2 and 3 complete
**Can Start:** After Week 2
**Estimated Effort:** M (Medium, 5-7 days)
**Phase:** 2 (Electron Service Migration - Week 3)

**Goal:** Migrate main wdio-electron-service package

#### 4.1 Package Migration (wdio-electron-service)

- [x] **4.1.1 Copy source code**
  - **Effort:** M
  - **Links to:** FR5
  - Copy service source to `packages/wdio-electron-service/src/`
  - Verify all files (launcher, service, commands, types)

- [x] **4.1.2 Create package.json**
  - **Effort:** M
  - **Links to:** FR5, TR6
  - Create package.json with dual exports
  - Add workspace dependencies:
    - @wdio/electron-utils (`workspace:*`)
    - @wdio/electron-cdp-bridge (`workspace:*`)
  - Configure peer dependencies (WebdriverIO, Electron)
  - Set up build scripts

- [x] **4.1.3 Update imports**
  - **Effort:** M
  - **Links to:** FR5
  - Update imports to use workspace packages
  - Verify no circular dependencies
  - Test import resolution

- [x] **4.1.4 Create TypeScript configs**
  - **Effort:** S
  - **Links to:** FR3
  - Create tsconfig.json and tsconfig.cjs.json

- [x] **4.1.5 Migrate tests**
  - **Effort:** L
  - **Links to:** FR7
  - Copy all service tests
  - Copy integration tests
  - Update test imports
  - Update mocks for workspace packages

- [x] **4.1.6 Build and validate**
  - **Effort:** M
  - **Links to:** FR5, TR4
  - Build ESM and CJS bundles
  - Generate type declarations
  - Verify exports

#### 4.2 Feature Validation

- [x] **4.2.1 Validate binary detection**
  - **Effort:** M
  - **Links to:** FR6
  - Test Electron Forge detection
  - Test Electron Builder detection
  - Test unpackaged app detection
  - Test manual path configuration

- [x] **4.2.2 Validate Chromedriver management**
  - **Effort:** M
  - **Links to:** FR6
  - Test automatic download
  - Test version mapping
  - Test manual configuration

- [x] **4.2.3 Validate API mocking system**
  - **Effort:** M
  - **Links to:** FR6
  - Test mock creation
  - Test mock implementation methods
  - Test mock inspection
  - Test global mock management

- [x] **4.2.4 Validate window management**
  - **Effort:** M
  - **Links to:** FR6
  - Test automatic window focus
  - Test manual window control
  - Test multiremote scenarios

- [x] **4.2.5 Validate platform-specific features**
  - **Effort:** M
  - **Links to:** FR6
  - Test AppArmor workaround (Linux)
  - Test headless mode
  - Test fuse detection

#### 4.3 Testing and Coverage

- [x] **4.3.1 Run all package tests**
  - **Effort:** M
  - **Links to:** FR7
  - Run unit tests
  - Run integration tests
  - Verify all tests pass

- [x] **4.3.2 Verify coverage**
  - **Effort:** M
  - **Links to:** FR7, NFR4
  - Generate coverage reports
  - Verify 80%+ coverage threshold
  - Identify any coverage gaps

---

### Task Group 5: Integration and Validation (Week 4, 3-5 days)

**Dependencies:** Task Group 4 complete
**Can Start:** After Week 3
**Estimated Effort:** S-M (Small-Medium, 3-5 days)
**Phase:** 2 (Electron Service Migration - Week 4)

**Goal:** Migrate examples, E2E tests, and validate entire system

#### 5.1 Example Applications Migration

- [ ] **5.1.1 Migrate example apps**
  - **Effort:** M
  - **Links to:** FR8
  - Copy examples to `examples/electron/`:
    - forge-cjs
    - forge-esm
    - builder-cjs
    - builder-esm
    - unpackaged
  - Update dependencies to workspace packages
  - Update build scripts

- [ ] **5.1.2 Build example applications**
  - **Effort:** M
  - **Links to:** FR8
  - Run build for each example
  - Verify successful builds
  - Document build process

- [ ] **5.1.3 Test example applications**
  - **Effort:** M
  - **Links to:** FR8, NFR1
  - Run each example app
  - Verify service functionality
  - Test on local platform

#### 5.2 E2E Test Migration

- [ ] **5.2.1 Migrate E2E test fixtures**
  - **Effort:** M
  - **Links to:** FR9
  - Copy E2E test apps to `e2e/electron/fixtures/`
  - Update build scripts
  - Build all fixtures

- [ ] **5.2.2 Migrate E2E test scenarios**
  - **Effort:** M
  - **Links to:** FR9
  - Copy E2E tests to `e2e/electron/test/`
  - Update imports to workspace packages
  - Update test configuration

- [ ] **5.2.3 Run E2E tests**
  - **Effort:** M
  - **Links to:** FR9
  - Run E2E test suite
  - Verify all tests pass
  - Document any failures

#### 5.3 Full System Validation

- [ ] **5.3.1 Run full test suite**
  - **Effort:** M
  - **Links to:** NFR1, NFR4
  - Run `turbo test` for all packages
  - Verify all package tests pass
  - Verify E2E tests pass
  - Check overall coverage

- [ ] **5.3.2 Validate Turborepo pipeline**
  - **Effort:** M
  - **Links to:** FR2, NFR2
  - Test `turbo build`
  - Test `turbo lint`
  - Test `turbo typecheck`
  - Verify caching works (run twice, check speedup)

- [ ] **5.3.3 Verify package builds**
  - **Effort:** M
  - **Links to:** TR4
  - Build all packages
  - Verify ESM outputs
  - Verify CJS outputs
  - Verify type declarations

- [ ] **5.3.4 Manual testing**
  - **Effort:** M
  - **Links to:** NFR1
  - Create test project using migrated service
  - Run basic Electron tests
  - Verify backward compatibility

#### 5.4 Documentation

- [ ] **5.4.1 Update Electron service README**
  - **Effort:** M
  - **Links to:** FR11
  - Update for monorepo context
  - Document workspace package usage
  - Update migration notes

- [ ] **5.4.2 Document reference patterns**
  - **Effort:** M
  - **Links to:** FR12
  - Document code organization patterns
  - Document test patterns
  - Document build patterns
  - Create guide for future services

---

### Task Group 6: CI/CD Setup (Week 5, 5-7 days)

**Dependencies:** Task Group 5 complete
**Can Start:** After Week 4
**Estimated Effort:** M (Medium, 5-7 days)
**Phase:** 3 (CI/CD Integration)

**Goal:** Set up comprehensive CI/CD based on Electron's actual testing requirements

#### 6.1 Main CI Workflow

- [ ] **6.1.1 Create ci.yml workflow**
  - **Effort:** L
  - **Links to:** FR10, TR7
  - Create `.github/workflows/ci.yml`
  - Define trigger events (push, pull_request)
  - Set up job structure:
    - lint
    - typecheck
    - test-package (matrix)
    - build
    - test-e2e (matrix)

- [ ] **6.1.2 Configure lint job**
  - **Effort:** M
  - **Links to:** FR10
  - Set up pnpm and Node.js
  - Run `turbo lint`
  - Configure caching

- [ ] **6.1.3 Configure typecheck job**
  - **Effort:** M
  - **Links to:** FR10
  - Set up pnpm and Node.js
  - Run `turbo typecheck`
  - Configure caching

- [ ] **6.1.4 Configure build job**
  - **Effort:** M
  - **Links to:** FR10
  - Set up pnpm and Node.js
  - Run `turbo build`
  - Upload build artifacts
  - Configure caching

#### 6.2 Test Jobs (Multi-Platform Matrix)

- [ ] **6.2.1 Configure package test matrix**
  - **Effort:** L
  - **Links to:** FR10, TR7
  - Define platform matrix:
    - ubuntu-latest
    - windows-latest
    - macos-latest
  - Set up pnpm and Node.js
  - Install dependencies
  - Run `turbo test`
  - Run `turbo test:coverage`

- [ ] **6.2.2 Configure coverage reporting**
  - **Effort:** M
  - **Links to:** FR10
  - Generate coverage reports
  - Upload to Codecov (ubuntu only)
  - Verify 80%+ threshold
  - Fail build if coverage < 80%

- [ ] **6.2.3 Configure E2E test matrix**
  - **Effort:** L
  - **Links to:** FR10
  - Define platform matrix (ubuntu, windows, macos)
  - Build E2E apps
  - Run E2E tests
  - Upload test results

#### 6.3 CI Optimizations

- [ ] **6.3.1 Configure pnpm caching**
  - **Effort:** M
  - **Links to:** FR10, NFR2
  - Use pnpm/action-setup with cache
  - Configure store caching
  - Verify cache hits

- [ ] **6.3.2 Configure Turborepo caching**
  - **Effort:** M
  - **Links to:** FR10, NFR2
  - Set up Turborepo remote caching (optional)
  - Configure cache restore/save
  - Verify build time improvements

- [ ] **6.3.3 Optimize job execution**
  - **Effort:** M
  - **Links to:** NFR2
  - Configure parallel job execution
  - Optimize job dependencies
  - Reduce redundant work

#### 6.4 Release Workflow

- [ ] **6.4.1 Create release.yml workflow**
  - **Effort:** M
  - **Links to:** FR10
  - Create basic release workflow
  - Configure manual trigger or version tag
  - Set up npm publishing (if needed)
  - Document release process

#### 6.5 CI Validation

- [ ] **6.5.1 Test CI workflow on feature branch**
  - **Effort:** M
  - **Links to:** FR10
  - Create test branch
  - Push changes
  - Verify all jobs run
  - Verify all jobs pass

- [ ] **6.5.2 Test multi-platform execution**
  - **Effort:** M
  - **Links to:** FR10, TR7
  - Verify ubuntu jobs pass
  - Verify windows jobs pass
  - Verify macos jobs pass
  - Check for platform-specific failures

- [ ] **6.5.3 Validate coverage reporting**
  - **Effort:** M
  - **Links to:** FR10
  - Check coverage reports generated
  - Verify Codecov upload works
  - Verify 80% threshold enforced

- [ ] **6.5.4 Measure CI performance**
  - **Effort:** M
  - **Links to:** NFR2
  - Measure total CI time
  - Measure cache effectiveness
  - Identify bottlenecks
  - Document CI performance

#### 6.6 Documentation

- [ ] **6.6.1 Document CI/CD setup**
  - **Effort:** M
  - **Links to:** FR11
  - Document workflow structure
  - Document multi-platform testing
  - Document caching strategy
  - Document release process

- [ ] **6.6.2 Document CI patterns for future services**
  - **Effort:** M
  - **Links to:** FR12
  - Create CI/CD pattern guide
  - Document platform matrix setup
  - Document test job patterns
  - Document caching best practices

---

## Summary

**Total Task Groups:** 6
**Total Tasks:** ~90-110 tasks
**Timeline:** 4-5 weeks

| Task Group | Duration | Week(s) | Tasks | Key Deliverables |
|------------|----------|---------|-------|------------------|
| TG1: Monorepo Foundation | 5-7 days | Week 1 | ~25 | Workspace, Turborepo, shared configs |
| TG2: Utils Migration | 5-7 days | Week 2 | ~10 | @wdio/electron-utils migrated |
| TG3: CDP Bridge Migration | 3-4 days | Week 2 | ~10 | @wdio/electron-cdp-bridge migrated |
| TG4: Service Migration | 5-7 days | Week 3 | ~20 | wdio-electron-service migrated |
| TG5: Integration & Validation | 3-5 days | Week 4 | ~15 | Examples, E2E, validation complete |
| TG6: CI/CD Setup | 5-7 days | Week 5 | ~20 | CI/CD operational on all platforms |

## Validation Checklist

After all task groups complete:

- [ ] All 3 Electron packages migrated and functional
- [ ] All features working (binary detection, CDP, mocking, window mgmt)
- [ ] 80%+ test coverage maintained for all packages
- [ ] All tests passing in monorepo context
- [ ] Examples working on all platforms
- [ ] E2E tests passing
- [ ] CI/CD operational (ubuntu, windows, macos)
- [ ] Turborepo caching working (50%+ speedup on rebuild)
- [ ] Documentation complete
- [ ] No breaking changes to Electron APIs
- [ ] Ready for Item #2 (Shared Core Utilities extraction)
