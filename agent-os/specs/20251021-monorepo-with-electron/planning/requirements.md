# Requirements: Monorepo Foundation with Electron Service

**Spec ID:** 20251021-monorepo-with-electron
**Roadmap Item:** #1 (Roadmap V2)
**Priority:** High (Foundation)
**Estimated Effort:** Large (L) - 4-5 weeks

## Overview

Establish the foundational monorepo infrastructure for the WebdriverIO Cross-Platform Testing Services project **while simultaneously** migrating the Electron service from its standalone repository. This combined approach ensures CI/CD is based on actual testing requirements, not guesswork.

## Context

This spec combines OLD Roadmap Items #1 (Monorepo Foundation) and #2 (Electron Service Migration) into a single, practical deliverable.

**Source Repository:** `/Users/sam/Workspace/wdio-electron-service`
**Target Location:** `/Users/sam/Workspace/wdio-desktop-mobile-testing/`

**Key Principle:** Infrastructure decisions informed by actual requirements (Electron's multi-platform testing, E2E tests, coverage).

## Functional Requirements

### FR1: Monorepo Workspace Setup
**Priority:** Must Have
**Source:** OLD Item #1
**Phase:** 1 (Week 1)

- [ ] Configure pnpm workspace (pnpm-workspace.yaml)
- [ ] Set up monorepo directory structure:
  - `packages/` - Service packages
  - `examples/` - Example applications
  - `e2e/` - E2E test scenarios
  - `docs/` - Documentation
- [ ] Configure pnpm workspaces for package linking
- [ ] Set up package naming conventions (@wdio/* scope)
- [ ] Create root package.json with workspace management

### FR2: Turborepo Build Orchestration
**Priority:** Must Have
**Source:** OLD Item #1
**Phase:** 1 (Week 1)

- [ ] Install and configure Turborepo 2.5+
- [ ] Define turbo.json pipeline configuration:
  - `build` task (with caching)
  - `test` task (with caching)
  - `lint` task (with caching)
  - `typecheck` task (with caching)
  - `format` task
- [ ] Configure task dependencies (e.g., build before test)
- [ ] Set up remote caching strategy (optional)
- [ ] Enable parallel execution for independent tasks

### FR3: Shared TypeScript Configuration
**Priority:** Must Have
**Source:** OLD Item #1
**Phase:** 1 (Week 1)

- [ ] Create base TypeScript configs:
  - `tsconfig.base.json` (ESM)
  - `tsconfig.base.cjs.json` (CommonJS)
- [ ] Configure TypeScript 5.9+ compiler options
- [ ] Set up path aliases (if needed)
- [ ] Define shared type definitions
- [ ] Support dual ESM/CJS builds

### FR4: Consistent Package Structure
**Priority:** Must Have
**Source:** OLD Item #1, Electron service patterns
**Phase:** 1 (Week 1)

Define standard package structure template:
```
packages/package-name/
├── src/
│   ├── index.ts
│   ├── launcher.ts (if service)
│   ├── service.ts (if service)
│   └── ...
├── test/
│   └── *.spec.ts
├── dist/
│   ├── esm/
│   └── cjs/
├── package.json
├── tsconfig.json (extends base)
├── vitest.config.ts
└── README.md
```

Requirements:
- [ ] Define standard package structure template
- [ ] Document package naming conventions
- [ ] Create package.json template with required fields:
  - Exports (ESM/CJS)
  - Type definitions
  - Peer dependencies (WebdriverIO)
  - License (MIT)
  - Repository links
- [ ] Set up build scripts (Rollup or custom)

### FR5: Electron Package Migration
**Priority:** Must Have
**Source:** OLD Item #2
**Phase:** 2 (Weeks 2-4)

Migrate the following packages from standalone repo to monorepo:

- [ ] **`@wdio/electron-utils`** → `packages/@wdio/electron-utils/`
  - Binary path detection
  - Configuration parsing
  - Platform utilities
  - Build tool support (Forge, Builder)

- [ ] **`@wdio/electron-cdp-bridge`** → `packages/@wdio/electron-cdp-bridge/`
  - Chrome DevTools Protocol bridge
  - Main process access
  - WebSocket connection management

- [ ] **`wdio-electron-service`** → `packages/wdio-electron-service/`
  - Main service package
  - Launcher and service entry points
  - All existing features

Each package must:
- [ ] Maintain existing API contracts
- [ ] Preserve all existing features
- [ ] Keep current version numbers initially
- [ ] Update internal imports to use workspace protocol (`workspace:*`)
- [ ] Update package.json for monorepo context

### FR6: Electron Feature Preservation
**Priority:** Must Have
**Source:** OLD Item #2
**Phase:** 2 (Weeks 2-4)

Ensure ALL existing Electron features continue to work:

#### Binary Detection & Management
- [ ] Automatic binary path detection (Electron Forge, Builder, unpackaged)
- [ ] Manual binary path configuration
- [ ] App arguments support
- [ ] Platform-specific binary naming

#### Chromedriver Management
- [ ] Automatic Chromedriver download (Electron v26+)
- [ ] Version mapping (electron-to-chromium)
- [ ] Manual Chromedriver configuration support

#### Main Process Access (CDP Bridge)
- [ ] Chrome DevTools Protocol connection
- [ ] Debug port allocation
- [ ] Runtime context initialization
- [ ] Execute scripts in main process
- [ ] Error handling and retry logic

#### API Mocking System
- [ ] Mock creation (inner/outer dual mock system)
- [ ] Mock implementation methods (mockImplementation, mockReturnValue, etc.)
- [ ] Mock inspection (calls, results, invocationCallOrder)
- [ ] Mock lifecycle (mockClear, mockReset, mockRestore)
- [ ] Mock utilities (mockAll, isMockFunction, getMockImplementation)
- [ ] Global mock management (clearAllMocks, resetAllMocks, restoreAllMocks)

#### Window Management
- [ ] Automatic window focus management (Puppeteer integration)
- [ ] Manual window control (getWindowHandles, switchToWindow)
- [ ] Multiremote window management

#### Platform-Specific Features
- [ ] AppArmor workaround (Linux/Ubuntu 24.04+)
- [ ] Headless testing support
- [ ] Electron fuse detection
- [ ] Cross-platform compatibility (Windows, macOS, Linux)

#### Configuration & Setup
- [ ] Service-level configuration
- [ ] Capability-level configuration
- [ ] Configuration merging strategy
- [ ] Standalone mode support

### FR7: Test Coverage Maintenance
**Priority:** Must Have
**Source:** OLD Item #2, Tech Stack (80% requirement)
**Phase:** 2 (Weeks 2-4)

- [ ] Migrate all existing tests from standalone repository
- [ ] Maintain 80%+ coverage for each package:
  - @wdio/electron-utils
  - @wdio/electron-cdp-bridge
  - wdio-electron-service
- [ ] Update test imports to use workspace packages
- [ ] Ensure all tests pass in monorepo context
- [ ] Update test configuration for monorepo

Test types to migrate:
- [ ] Unit tests for utilities (binary detection, config parsing)
- [ ] Integration tests for CDP bridge
- [ ] Service tests for main service (launcher, service lifecycle)
- [ ] E2E tests (application launch, multiremote, standalone)

### FR8: Example Applications Migration
**Priority:** Must Have
**Source:** OLD Item #2
**Phase:** 2 (Week 4)

Migrate example applications from standalone repo:

- [ ] Example apps to `examples/electron/`
- [ ] Update dependencies to use workspace packages
- [ ] Ensure examples still work
- [ ] Update example documentation

Common example types:
- [ ] Basic Electron app
- [ ] Electron Forge configuration
- [ ] Electron Builder configuration
- [ ] Unpackaged app
- [ ] Multiremote scenario

### FR9: E2E Test Fixtures Migration
**Priority:** Must Have
**Source:** OLD Item #2
**Phase:** 2 (Week 4)

Migrate E2E test applications and fixtures:

- [ ] E2E test apps to `e2e/` or `fixtures/`
- [ ] Package test scenarios
- [ ] Configuration variations
- [ ] Update build scripts for E2E apps
- [ ] Validate E2E tests pass in monorepo

### FR10: CI/CD Pipeline Setup
**Priority:** Must Have
**Source:** OLD Items #1 and #2 (merged)
**Phase:** 3 (Week 5)

Set up GitHub Actions workflows **based on Electron's actual testing requirements**:

- [ ] **Main CI Workflow** (`ci.yml`):
  - Lint job (Biome + ESLint across all packages)
  - Format check job
  - Type check job (TypeScript compiler)
  - Unit tests job (Vitest with 80% coverage requirement)
  - Build job (all packages)
  - E2E tests job (integration tests)

- [ ] **Multi-Platform Matrix:**
  - Ubuntu (latest) - Linux testing
  - Windows (latest) - Windows testing
  - macOS (latest) - macOS testing

- [ ] **Package Tests:**
  - Run Vitest tests for all packages
  - Generate coverage reports
  - Fail if coverage < 80%

- [ ] **E2E Tests:**
  - Build E2E test applications
  - Run E2E test scenarios
  - Multi-platform validation

- [ ] **CI Optimizations:**
  - Configure test result caching
  - Set up build artifact caching
  - Integrate Turborepo remote caching
  - Parallel job execution

- [ ] **Release Workflow** (basic):
  - `release.yml` - Basic release automation (can be refined later)

### FR11: Documentation
**Priority:** Must Have
**Source:** OLD Items #1 and #2
**Phase:** 1-3 (throughout implementation)

- [ ] **Monorepo Documentation:**
  - Root README with setup instructions
  - Monorepo setup guide
  - Package structure conventions
  - Build and test commands
  - Contribution guidelines

- [ ] **Electron Service Documentation:**
  - Update README for monorepo context
  - API documentation
  - Migration guide (from standalone to monorepo)
  - Workspace package usage examples

- [ ] **Reference Patterns Documentation:**
  - Document patterns for future services
  - CI/CD patterns for Flutter/Neutralino/Tauri
  - Test migration patterns
  - Package structure best practices

### FR12: Reference Implementation Refinement
**Priority:** Must Have
**Source:** OLD Item #2 (establish as reference for other services)
**Phase:** 2-3 (Weeks 2-5)

Refine Electron service to be exemplary for Flutter/Neutralino/Tauri:

- [ ] **Code Organization:**
  - Clear separation of concerns
  - Well-documented patterns
  - Reusable abstractions identified (for Item #2: Shared Core Utilities)

- [ ] **Package Structure:**
  - Exemplary package.json (exports, types, peer deps)
  - Clear entry points (launcher.ts, service.ts)
  - Logical directory structure

- [ ] **Testing Patterns:**
  - Clear test organization
  - Good mocking patterns
  - Integration test examples
  - E2E test patterns

- [ ] **Documentation:**
  - Inline code comments
  - Architecture documentation
  - Pattern explanations for future services

## Technical Requirements

### TR1: Package Manager
**Priority:** Must Have
**Source:** Tech Stack
**Phase:** 1 (Week 1)

- **Tool:** pnpm 10.12+
- **Why:** Efficient disk usage, better monorepo support
- [ ] Install pnpm
- [ ] Configure .npmrc with pnpm settings
- [ ] Set up pnpm catalog for dependency management (optional)
- [ ] Configure workspace protocol for internal dependencies

### TR2: Code Quality Tools
**Priority:** Must Have
**Source:** Tech Stack
**Phase:** 1 (Week 1)

**Linting & Formatting:**
- [ ] Biome 2.2.5 (formatter and linter)
- [ ] ESLint 9.37+ with @typescript-eslint/parser 8.46+
- [ ] Plugins: @vitest/eslint-plugin, eslint-plugin-wdio
- [ ] Configure Biome for TypeScript
- [ ] Create shared ESLint config

**Pre-commit Hooks:**
- [ ] Husky 9.1+ for Git hooks
- [ ] lint-staged 16.2+ for staged file processing
- [ ] Configure pre-commit hook to auto-format and lint

### TR3: Testing Framework
**Priority:** Must Have
**Source:** Tech Stack
**Phase:** 1 (Week 1)

- [ ] Vitest 3.2+ for unit and integration tests
- [ ] @vitest/coverage-v8 for coverage reporting
- [ ] jsdom 27.0+ for DOM testing
- [ ] Shared vitest.config.ts configuration
- [ ] 80% minimum coverage requirement
- [ ] Test file naming: `*.spec.ts`

### TR4: Build Tools
**Priority:** Must Have
**Source:** Tech Stack, Electron service reference
**Phase:** 1 (Week 1)

- [ ] Rollup 4.52+ for package bundling
- [ ] Custom TypeScript build scripts (follow electron service pattern)
- [ ] Support dual ESM/CJS builds
- [ ] Generate TypeScript declaration files
- [ ] Configure proper exports in package.json

### TR5: Node.js and Module System
**Priority:** Must Have
**Source:** Tech Stack
**Phase:** 1 (Week 1)

- [ ] Node.js 18 LTS or 20 LTS (dual support)
- [ ] ES Modules (ESM) with CommonJS (CJS) dual build
- [ ] Configure package.json "type": "module" where appropriate
- [ ] Ensure CJS compatibility for WDIO plugins

### TR6: Dependency Management
**Priority:** Must Have
**Source:** Tech Stack, OLD Item #2
**Phase:** 2 (Weeks 2-4)

Update dependencies for migrated Electron packages:
- [ ] WebdriverIO 9.0+ (peer dependency)
- [ ] Use pnpm catalog for shared dependencies (if applicable)
- [ ] Update Electron peer dependency range
- [ ] Update devDependencies to monorepo versions
- [ ] Remove duplicate dependencies (use shared from root)

### TR7: CI/CD Platform
**Priority:** Must Have
**Source:** OLD Item #1, enhanced with Electron requirements
**Phase:** 3 (Week 5)

- [ ] GitHub Actions
- [ ] Multi-platform matrix (ubuntu, windows, macos)
- [ ] E2E test infrastructure
- [ ] Coverage reporting integration
- [ ] Turborepo caching in CI
- [ ] Artifact upload/download for builds

### TR8: Version Management
**Priority:** Must Have
**Source:** Best practices
**Phase:** 2-3 (Weeks 2-5)

- [ ] Keep current Electron version numbers initially (avoid breaking changes)
- [ ] Prepare for coordinated releases (with other packages)
- [ ] Update changelog format for monorepo
- [ ] Document versioning strategy

## Non-Functional Requirements

### NFR1: Backward Compatibility (Electron Service)
**Priority:** Must Have
**Source:** OLD Item #2

- [ ] All existing Electron APIs must work identically
- [ ] No breaking changes to public interfaces
- [ ] Existing user configurations still valid
- [ ] Standalone mode API unchanged

**Critical:** Production users depend on this package. Any breaking changes require major version bump.

### NFR2: Performance
**Priority:** Should Have
**Source:** OLD Items #1 and #2

**Monorepo:**
- [ ] Turbo caching reduces subsequent build times by 50%+
- [ ] Parallel task execution where possible
- [ ] CI pipeline completes in under 15 minutes

**Electron Service:**
- [ ] No performance regressions from migration
- [ ] Maintain or improve test execution time
- [ ] Build time comparable or better (with Turbo caching)

### NFR3: Developer Experience
**Priority:** Must Have
**Source:** OLD Item #1

- [ ] Clear README with setup instructions
- [ ] Single command to install dependencies (`pnpm install`)
- [ ] Single command to run all checks (`pnpm turbo lint test typecheck`)
- [ ] Local development same as CI environment
- [ ] Fast feedback loop (Turbo caching)

### NFR4: Code Quality
**Priority:** Must Have
**Source:** Tech Stack, Standards

- [ ] Pass all linting rules (Biome, ESLint)
- [ ] Pass all formatting checks
- [ ] TypeScript strict mode compliant
- [ ] No new warnings or errors
- [ ] 80%+ test coverage maintained

### NFR5: Maintainability
**Priority:** Must Have
**Source:** OLD Items #1 and #2

- [ ] All configurations documented
- [ ] Consistent tooling versions across packages
- [ ] Code well-documented
- [ ] Clear architecture
- [ ] Easy to extend (for Item #2: extracting shared utilities)
- [ ] Reference-quality implementation

### NFR6: Standards Compliance
**Priority:** Must Have
**Source:** Standards

- [ ] Follow conventions from `/agent-os/standards/global/monorepo-conventions.md`
- [ ] Follow conventions from `/agent-os/standards/global/best-practices.md`
- [ ] MIT License throughout
- [ ] OpenJS Foundation conventions

## Migration Strategy

### Strategy 1: Incremental Migration
**Priority:** Recommended Approach
**Phase:** 2 (Weeks 2-4)

- [ ] Migrate packages one at a time
- [ ] Validate each package before moving to next
- [ ] Maintain working state at each step

**Order:**
1. Week 2: `@wdio/electron-utils` (no dependencies)
2. Week 2: `@wdio/electron-cdp-bridge` (depends on utils)
3. Week 3: `wdio-electron-service` (depends on both)
4. Week 4: Example apps and E2E fixtures

### Strategy 2: Testing Strategy
**Priority:** Must Have
**Phase:** 2-3 (Weeks 2-5)

- [ ] Run existing test suite after each migration step
- [ ] Add monorepo-specific tests if needed
- [ ] Validate against example applications
- [ ] Manual smoke testing on all platforms
- [ ] CI validation in Week 5

### Strategy 3: Rollback Plan
**Priority:** Should Have
**Phase:** 2 (Weeks 2-4)

- [ ] Keep standalone repo intact during migration
- [ ] Document rollback procedure
- [ ] Tag point before migration starts
- [ ] Can revert to standalone if critical issues found

## Dependencies

### Upstream Dependencies
- None (this is the foundation)

### Downstream Dependencies
- **Item #2:** Shared Core Utilities - Will extract common code from Electron service
- **Item #3:** Flutter Service - Will follow established patterns
- **Items #4-9:** All service implementations - Will use Electron service as reference

## Reference Materials

### Source Repository
**Location:** `/Users/sam/Workspace/wdio-electron-service`

**Key Areas to Study:**
- Package structure (`packages/` directories)
- Build scripts (`scripts/build-package.ts`)
- CI/CD workflows (`.github/workflows/`)
- Test organization (`test/` directories)
- Example applications (`e2e/` or `examples/` directories)
- Documentation (`README.md`, API docs)

### Product Documentation
- `/agent-os/product/roadmap.md` (V2)
- `/agent-os/product/tech-stack.md`
- `/agent-os/product/cross-framework-analysis.md` - Electron section
- `/agent-os/standards/global/monorepo-conventions.md`
- `/agent-os/standards/global/best-practices.md`

### Spec Documentation
- `/agent-os/specs/SPEC_COMBINATION_PLAN.md` - How this spec was created
- `/agent-os/ROADMAP_V2_CHANGES.md` - Why items were combined

### Technology Documentation
- pnpm workspaces: https://pnpm.io/workspaces
- Turborepo: https://turbo.build/repo/docs
- TypeScript Project References: https://www.typescriptlang.org/docs/handbook/project-references.html
- Vitest: https://vitest.dev/
- GitHub Actions: https://docs.github.com/en/actions

## Success Criteria

The monorepo foundation with Electron service is complete when:

1. ✅ **Monorepo functional:**
   - pnpm workspace working
   - Turborepo pipeline executing
   - Shared configs in use
   - Package structure conventions documented

2. ✅ **All Electron packages migrated:**
   - 3 packages in monorepo (@wdio/electron-utils, @wdio/electron-cdp-bridge, wdio-electron-service)
   - All features working
   - All tests passing (80%+ coverage)
   - Example apps working
   - E2E fixtures working

3. ✅ **CI/CD operational:**
   - Multi-platform testing (ubuntu, windows, macos)
   - Package tests running
   - E2E tests running
   - Coverage reporting
   - Turborepo caching working

4. ✅ **Reference quality:**
   - Well-documented patterns
   - Ready for other services to follow
   - CI patterns established for Flutter/Neutralino/Tauri

5. ✅ **Ready for Item #2:**
   - Shared utilities can be extracted
   - Flutter service can follow established patterns

## Out of Scope

- Extracting shared utilities (that's Item #2)
- Implementing new Electron features
- Breaking API changes to Electron service
- Rewriting existing Electron code (unless necessary for monorepo compatibility)
- Performance optimizations (unless fixing regressions)
- Flutter/Neutralino/Tauri services (those are Items #3-5)
- Documentation site (covered in Item #9)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Turborepo learning curve | Medium | Reference existing monorepo examples, start simple |
| pnpm compatibility issues | Medium | Test with both Node 18 and 20, follow pnpm docs closely |
| CI/CD complexity | Medium | Start with basic pipeline, iterate based on actual needs |
| Build tool configuration | Low | Copy proven patterns from wdio-electron-service |
| Import path changes break Electron functionality | High | Comprehensive test suite, careful validation |
| Test environment differences | Medium | Match CI environment closely, test on all platforms |
| Performance regressions | Low | Benchmark before/after, leverage Turbo caching |
| Breaking user configurations | High | Maintain backward compatibility, extensive testing |
| Dependency conflicts | Medium | Careful dependency management, use pnpm catalog |

## Questions for Clarification

1. Should we set up remote caching for Turborepo (e.g., Vercel Remote Cache)?
2. Should we update to latest dependencies during migration, or keep exact versions?
3. Do we need to maintain the standalone Electron repository for existing users, or deprecate it?
4. Should we cut a new Electron release from standalone repo before migration?
5. How should we handle the transition for npm users (publish from monorepo)?

## Acceptance Criteria

- [ ] Monorepo workspace configured and functional
- [ ] Turborepo pipeline runs successfully
- [ ] All Electron packages migrated (@wdio/electron-utils, @wdio/electron-cdp-bridge, wdio-electron-service)
- [ ] All Electron features functional (binary detection, CDP bridge, API mocking, window management, platform-specific features)
- [ ] 80%+ test coverage maintained for all packages
- [ ] All tests passing in monorepo context
- [ ] Example applications working
- [ ] E2E fixtures migrated and functional
- [ ] CI/CD pipeline passing on all platforms (ubuntu, windows, macos)
- [ ] Documentation complete (README, setup guide, pattern documentation)
- [ ] Turborepo caching working (build times reduced on subsequent runs)
- [ ] Ready to serve as reference for other services (Items #3-5)
- [ ] No breaking changes to Electron public APIs
- [ ] Backward compatibility maintained
- [ ] Ready for Item #2 (Shared Core Utilities extraction)
