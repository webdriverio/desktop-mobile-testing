# Specification: Monorepo Foundation with Electron Service

**Version:** 1.0
**Date:** 2025-10-21
**Status:** Draft
**Spec ID:** 20251021-monorepo-with-electron

## Goal

Establish a production-ready monorepo infrastructure for the WebdriverIO Cross-Platform Testing Services project **while simultaneously** migrating the Electron service from its standalone repository. This combined approach ensures CI/CD is based on actual testing requirements and provides a validated reference implementation for future services.

**Key Principle:** Infrastructure decisions informed by real requirements, not guesswork.

## User Stories

**Monorepo Foundation:**
- As a developer, I want to install all dependencies with a single command so that I can start working immediately
- As a developer, I want to run all quality checks locally before pushing so that I catch issues early
- As a contributor, I want clear package structure guidelines so that I can create new services following established patterns
- As a maintainer, I want automated CI/CD pipelines so that I can merge changes with confidence

**Electron Service Migration:**
- As a WebdriverIO Electron user, I want the service to continue working identically after migration so that my existing tests require no changes
- As a future service developer, I want a reference implementation to follow so that I can build Flutter/Neutralino/Tauri services with consistent patterns
- As a CI/CD pipeline operator, I want integrated testing across all packages so that I can validate changes efficiently

## Core Requirements Summary

See `planning/requirements.md` for complete requirements. Key requirements:

### Functional Requirements
- **FR1-FR4:** Monorepo workspace, Turborepo, TypeScript configs, package structure (Week 1)
- **FR5-FR9:** Electron package migration, feature preservation, tests, examples, E2E fixtures (Weeks 2-4)
- **FR10:** CI/CD pipeline based on Electron's actual testing needs (Week 5)
- **FR11-FR12:** Documentation and reference implementation refinement (Weeks 1-5)

### Technical Requirements
- **TR1-TR5:** Package manager (pnpm), code quality tools, testing (Vitest), build tools (Rollup), Node.js/ESM
- **TR6-TR8:** Dependency management, CI/CD platform (GitHub Actions), version management

### Non-Functional Requirements
- **NFR1:** Backward compatibility (Electron service - no breaking changes)
- **NFR2:** Performance (50%+ build time reduction with Turbo caching)
- **NFR3:** Developer experience (simple commands, fast feedback)
- **NFR4:** Code quality (80%+ coverage, strict TypeScript)
- **NFR5:** Maintainability (documented, consistent, extensible)
- **NFR6:** Standards compliance (MIT, OpenJS Foundation)

## Implementation Phases

### Phase 1: Monorepo Scaffolding (Week 1, 5-7 days)

**Goal:** Establish basic monorepo structure and tooling foundation

**Activities:**
1. Initialize monorepo directory structure
2. Configure pnpm workspace
3. Set up Turborepo with basic pipeline
4. Create shared TypeScript configurations (ESM + CJS)
5. Configure code quality tools (Biome, ESLint, Husky)
6. Set up Vitest for testing
7. Create package structure template
8. Document monorepo conventions

**Deliverables:**
- `pnpm-workspace.yaml` configured
- `turbo.json` with build, test, lint, typecheck tasks
- `tsconfig.base.json` and `tsconfig.base.cjs.json`
- Shared configs for Biome, ESLint, Vitest
- Root `package.json` with workspace management
- README with setup instructions

**Validation:**
- [ ] `pnpm install` works
- [ ] `pnpm turbo build` executes (even if no packages yet)
- [ ] TypeScript compilation configured
- [ ] Linting and formatting rules active
- [ ] Package structure template documented

### Phase 2: Electron Service Migration (Weeks 2-4, 15-21 days)

**Goal:** Migrate all Electron packages, preserve features, maintain test coverage

#### Week 2: Utils and CDP Bridge Migration (5-7 days)

**Packages to Migrate:**
1. `@wdio/electron-utils` - Binary detection, config parsing, platform utilities
2. `@wdio/electron-cdp-bridge` - CDP bridge for main process access

**Activities:**
- Copy package source code to `packages/`
- Update package.json for monorepo context
- Convert dependencies to workspace protocol (`workspace:*`)
- Update imports within packages
- Migrate unit tests
- Validate builds (ESM + CJS)
- Run tests and verify 80%+ coverage

**Validation:**
- [ ] Both packages build successfully
- [ ] All unit tests pass
- [ ] 80%+ coverage maintained
- [ ] TypeScript types generated
- [ ] Turborepo pipeline includes packages

#### Week 3: Service Migration (5-7 days)

**Package to Migrate:**
- `wdio-electron-service` - Main service package (launcher, service)

**Activities:**
- Copy service source code to `packages/wdio-electron-service/`
- Update package.json
- Convert dependencies to workspace protocol
- Update imports to reference workspace packages
- Migrate service tests and integration tests
- Validate all features work:
  - Binary detection (Forge, Builder, unpackaged)
  - Chromedriver management
  - CDP bridge connection
  - API mocking system
  - Window management
  - Platform-specific features
  - Configuration handling

**Validation:**
- [ ] Service package builds
- [ ] All tests pass
- [ ] 80%+ coverage maintained
- [ ] All features functional
- [ ] Integration tests pass

#### Week 4: Examples and E2E (3-5 days)

**Activities:**
- Migrate example applications to `examples/electron/`
- Migrate E2E test fixtures
- Update example dependencies to workspace packages
- Build example applications
- Run E2E test scenarios
- Manual smoke testing on all platforms

**Examples to Migrate:**
- Electron Forge (CJS + ESM variants)
- Electron Builder (CJS + ESM variants)
- Unpackaged apps
- Multiremote scenarios

**Validation:**
- [ ] All examples build successfully
- [ ] E2E tests pass
- [ ] Examples work on Windows, macOS, Linux
- [ ] Multiremote scenarios functional
- [ ] Standalone mode works

### Phase 3: CI/CD Integration (Week 5, 5-7 days)

**Goal:** Set up comprehensive CI/CD based on Electron's actual testing requirements

**Activities:**
1. **Create Main CI Workflow** (`.github/workflows/ci.yml`):
   - Lint job (Biome + ESLint)
   - Format check job
   - Type check job
   - Unit tests job (all packages)
   - Build job (all packages)
   - E2E tests job

2. **Configure Multi-Platform Matrix:**
   - Ubuntu (latest) - Linux testing
   - Windows (latest) - Windows testing
   - macOS (latest) - macOS testing

3. **Set up Test Jobs:**
   - Install pnpm and dependencies
   - Run Vitest tests with coverage
   - Generate coverage reports (fail if < 80%)
   - Upload coverage artifacts

4. **Set up E2E Test Jobs:**
   - Build E2E test applications
   - Run E2E scenarios
   - Cross-platform validation

5. **Configure CI Optimizations:**
   - pnpm store caching
   - Turborepo cache integration
   - Build artifact caching
   - Parallel job execution

6. **Create Release Workflow** (basic):
   - `.github/workflows/release.yml`
   - Version bumping (manual or automated)
   - Package publishing

**CI Workflow Example:**

```yaml
name: Monorepo CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo typecheck

  test-package:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo test
      - run: pnpm turbo test:coverage
      - uses: codecov/codecov-action@v3
        if: matrix.os == 'ubuntu-latest'

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm turbo build

  test-e2e:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build:electron-apps
      - run: pnpm turbo test:e2e
```

**Deliverables:**
- CI workflow configured
- All jobs passing on all platforms
- Coverage reporting integrated
- Turborepo caching working in CI
- Basic release workflow

**Validation:**
- [ ] All CI jobs pass on ubuntu, windows, macos
- [ ] Package tests run and report coverage
- [ ] E2E tests run on all platforms
- [ ] Caching reduces CI time
- [ ] No flaky tests
- [ ] Coverage meets 80%+ threshold

## Visual Design

N/A - Infrastructure project with no UI components

## Reusable Components

### From wdio-electron-service (Source Repository)

**Location:** `/Users/sam/Workspace/wdio-electron-service`

**Configurations to Reuse:**

1. **pnpm workspace configuration** (`pnpm-workspace.yaml`)
   - Package glob patterns
   - Dependency catalogs for version management
   - OnlyBuiltDependencies for native modules

2. **Turbo pipeline configuration** (`turbo.json`)
   - Build, test, lint task definitions
   - Task dependencies
   - Cache configuration

3. **TypeScript base configurations** (`tsconfig.base.json`, `tsconfig.base.cjs.json`)
   - ESM config with NodeNext resolution
   - CJS config with CommonJS
   - Strict type checking
   - Declaration generation

4. **Package.json patterns** (from Electron packages)
   - Dual exports (ESM/CJS)
   - Peer dependencies
   - Build scripts
   - Engine constraints

5. **CI/CD workflows** (`.github/workflows/`)
   - Multi-platform testing patterns
   - Coverage reporting
   - E2E test execution

6. **Test patterns** (`test/` directories)
   - Unit test organization
   - Integration test patterns
   - E2E test scenarios
   - Mocking strategies

### Electron Packages to Migrate

**Complete list of packages:**

1. **`@wdio/electron-utils`** (Week 2)
   - Binary path detection (Forge, Builder, unpackaged)
   - Configuration parsing
   - Platform utilities
   - Build tool support

2. **`@wdio/electron-cdp-bridge`** (Week 2)
   - Chrome DevTools Protocol bridge
   - Main process access
   - WebSocket connection management
   - Debug port allocation

3. **`wdio-electron-service`** (Week 3)
   - Main service package
   - Launcher implementation
   - Service lifecycle
   - Window management
   - API mocking system
   - Chromedriver management
   - Platform-specific features

### New Components to Create

**Monorepo Infrastructure:**

1. **Workspace configuration**
   - Root `package.json`
   - `pnpm-workspace.yaml`
   - `.npmrc` for pnpm settings

2. **Build orchestration**
   - `turbo.json` pipeline
   - Package build scripts
   - Turborepo cache configuration

3. **Shared configurations**
   - TypeScript configs (base, ESM, CJS)
   - Biome configuration
   - ESLint configuration
   - Vitest shared config

4. **Developer tooling**
   - Husky pre-commit hooks
   - lint-staged configuration
   - Package creation template
   - Contribution guidelines

5. **CI/CD workflows**
   - `.github/workflows/ci.yml`
   - `.github/workflows/release.yml`
   - Platform test matrix
   - Coverage integration

6. **Documentation**
   - Root README
   - Monorepo setup guide
   - Package structure guidelines
   - Migration patterns for future services

## Data Architecture

N/A - Infrastructure project, no persistent data

## Interfaces

### Monorepo Structure

```
desktop-mobile-testing/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Main CI pipeline
│       └── release.yml               # Release automation
├── packages/
│   ├── @wdio/
│   │   ├── electron-utils/           # Binary detection, config parsing
│   │   └── electron-cdp-bridge/      # CDP bridge for main process
│   └── wdio-electron-service/        # Main Electron service
├── examples/
│   └── electron/                     # Example applications
│       ├── forge-cjs/
│       ├── forge-esm/
│       ├── builder-cjs/
│       ├── builder-esm/
│       └── unpackaged/
├── e2e/                              # E2E test scenarios
│   └── electron/
│       ├── test/
│       └── fixtures/
├── docs/                             # Documentation
│   ├── setup.md
│   ├── package-structure.md
│   └── migration-patterns.md
├── pnpm-workspace.yaml               # Workspace configuration
├── turbo.json                        # Turborepo pipeline
├── tsconfig.base.json                # Base TypeScript config (ESM)
├── tsconfig.base.cjs.json            # Base TypeScript config (CJS)
├── biome.json                        # Biome configuration
├── eslint.config.js                  # ESLint configuration
├── package.json                      # Root package.json
├── .npmrc                            # pnpm settings
└── README.md                         # Main README
```

### Package Structure (Standard Template)

```
packages/package-name/
├── src/
│   ├── index.ts                      # Main entry point
│   ├── launcher.ts                   # Launcher (if service)
│   ├── service.ts                    # Service (if service)
│   ├── types.ts                      # Type definitions
│   └── utils/                        # Utilities
├── test/
│   ├── launcher.spec.ts              # Launcher tests
│   ├── service.spec.ts               # Service tests
│   └── utils.spec.ts                 # Utility tests
├── dist/
│   ├── esm/                          # ESM build output
│   │   ├── index.js
│   │   └── index.d.ts
│   └── cjs/                          # CJS build output
│       ├── index.js
│       └── index.d.ts
├── package.json                      # Package manifest
├── tsconfig.json                     # TypeScript config (extends base)
├── vitest.config.ts                  # Vitest config
└── README.md                         # Package documentation
```

### Package.json Template

```json
{
  "name": "@wdio/package-name",
  "version": "1.0.0",
  "type": "module",
  "description": "Package description",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "engines": {
    "node": "^18.12.0 || ^20.0.0"
  },
  "scripts": {
    "build": "pnpm build:esm && pnpm build:cjs",
    "build:esm": "tsc -p tsconfig.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "catalog:default",
    "typescript": "catalog:default",
    "vitest": "catalog:default"
  },
  "peerDependencies": {
    "webdriverio": "^9.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/webdriverio/desktop-mobile-testing.git",
    "directory": "packages/package-name"
  },
  "license": "MIT"
}
```

## API Specifications

### Electron Service APIs (Preserved)

All existing Electron service APIs must work identically after migration:

**Binary Detection:**
```typescript
detectElectronBinary(options: BinaryOptions): Promise<string>
```

**CDP Bridge:**
```typescript
class CdpBridge {
  connect(port: number): Promise<void>
  execute(script: string): Promise<any>
  disconnect(): Promise<void>
}
```

**API Mocking:**
```typescript
browser.electron.mock(apiName: string, options?: MockOptions): Mock
browser.electron.mockAll(handlers: Record<string, Function>): void
browser.electron.clearAllMocks(): void
```

**Window Management:**
```typescript
browser.electron.getWindowHandles(): Promise<string[]>
browser.switchToWindow(handle: string): Promise<void>
```

See Electron service documentation for complete API reference.

### Monorepo Development APIs

**Workspace Commands:**
```bash
pnpm install                    # Install all dependencies
pnpm turbo build                # Build all packages
pnpm turbo test                 # Run all tests
pnpm turbo lint                 # Lint all packages
pnpm turbo typecheck            # Type check all packages
```

**Per-Package Commands:**
```bash
pnpm --filter @wdio/electron-utils build    # Build specific package
pnpm --filter wdio-electron-service test    # Test specific package
```

**Development Commands:**
```bash
pnpm dev                        # Watch mode for development
pnpm clean                      # Clean build artifacts
pnpm format                     # Format code
```

## Success Criteria

See `planning/requirements.md` for detailed acceptance criteria. Summary:

### Phase 1: Monorepo Scaffolding
- ✅ Workspace functional (pnpm install works)
- ✅ Turborepo pipeline configured
- ✅ Shared configs created
- ✅ Package structure template documented

### Phase 2: Electron Service Migration
- ✅ All 3 Electron packages migrated
- ✅ All features working (binary detection, CDP, mocking, window mgmt)
- ✅ 80%+ test coverage maintained
- ✅ Examples and E2E fixtures working

### Phase 3: CI/CD Integration
- ✅ CI passing on ubuntu, windows, macos
- ✅ Package tests running with coverage
- ✅ E2E tests running on all platforms
- ✅ Turborepo caching working

### Overall
- ✅ Ready for Item #2 (Shared Core Utilities extraction)
- ✅ Reference quality for Flutter/Neutralino/Tauri services
- ✅ No breaking changes to Electron APIs
- ✅ Documentation complete

## Timeline

**Total Duration:** 4-5 weeks

| Phase | Duration | Weeks | Key Deliverables |
|-------|----------|-------|------------------|
| Phase 1: Monorepo Scaffolding | 5-7 days | Week 1 | Workspace, Turborepo, shared configs |
| Phase 2: Electron Migration | 15-21 days | Weeks 2-4 | All packages, tests, examples migrated |
| - Week 2: Utils + CDP Bridge | 5-7 days | Week 2 | 2 packages migrated and tested |
| - Week 3: Service | 5-7 days | Week 3 | Main service migrated and tested |
| - Week 4: Examples + E2E | 3-5 days | Week 4 | Examples and E2E working |
| Phase 3: CI/CD Integration | 5-7 days | Week 5 | CI/CD operational on all platforms |

## Out of Scope

- Extracting shared utilities (Item #2: Shared Core Utilities)
- Implementing new Electron features
- Breaking API changes to Electron service
- Rewriting existing Electron code (unless necessary for monorepo)
- Performance optimizations (unless fixing regressions)
- Flutter/Neutralino/Tauri services (Items #3-5)
- Documentation site (Item #9)
- Release automation refinement (basic only)

## Risks and Mitigations

See `planning/requirements.md` for complete risk analysis. Key risks:

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Import path changes break Electron | High | Medium | Comprehensive test suite, careful validation |
| CI/CD complexity | Medium | Medium | Start simple, iterate based on actual needs |
| Breaking user configurations | High | Low | Maintain backward compat, extensive testing |
| Performance regressions | Medium | Low | Benchmark before/after, leverage Turbo caching |

## Dependencies

**Upstream:** None (this is the foundation)

**Downstream:**
- Item #2: Shared Core Utilities (extracts from Electron)
- Item #3: Flutter Service (follows patterns)
- Items #4-9: All services (use as reference)

## Related Documentation

- `planning/initialization.md` - Context and goals
- `planning/requirements.md` - Complete requirements
- `tasks.md` - Detailed task breakdown
- `COMBINATION_NOTES.md` - How this spec was created
- `/agent-os/specs/SPEC_COMBINATION_PLAN.md` - Combination strategy
- `/agent-os/ROADMAP_V2_CHANGES.md` - Why items were combined
