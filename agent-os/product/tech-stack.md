# Tech Stack

**Version:** 1.1.0
**Last Updated:** 2025-10-20

## Context

Technical stack choices for the WebdriverIO Cross-Platform Testing Services monorepo. This document outlines all technologies, tools, and frameworks used across the codebase.

## Core Language and Runtime

- **Primary Language:** TypeScript 5.9+
- **Node.js Version:** 18 LTS or 20 LTS (dual support)
- **Module System:** ES Modules (ESM) with CommonJS (CJS) dual build support
- **Package Manager:** pnpm 10.12+
- **TypeScript Config:** Shared base configs (`tsconfig.base.json`, `tsconfig.base.cjs.json`)

## Monorepo Architecture

- **Monorepo Tool:** Turborepo 2.5+
- **Workspace Manager:** pnpm workspaces
- **Package Structure:** Multi-package monorepo with `packages/`, `examples/`, `e2e/` directories
- **Build Orchestration:** Turbo pipeline configuration for parallel builds, tests, and linting
- **Version Management:** package-versioner 0.9+ for coordinated releases

## Core Testing Framework

- **Testing Framework:** WebdriverIO 9.0+ (peer dependency)
- **Service Architecture:** WebdriverIO service pattern with `launcher.ts` and `service.ts` entry points
- **Browser Automation:** Chromedriver (auto-managed for Electron v26+)
- **Protocol Bridge:** Custom CDP (Chrome DevTools Protocol) bridge for main process access

## Build and Compilation

- **Build Tool:** Rollup 4.52+ (for package bundling)
- **Build Script:** Custom TypeScript build scripts (`scripts/build-package.ts`)
- **Module Formats:** Dual ESM/CJS builds with proper exports configuration
- **TypeScript Compiler:** tsc (TypeScript 5.9+) for type checking and declaration files
- **Bundler (Examples):** Various (supports Electron Forge, Electron Builder, Vite)

## Testing and Quality Assurance

### Unit and Integration Testing
- **Test Framework:** Vitest 3.2+ with coverage via @vitest/coverage-v8
- **Test Organization:** `test/` directory at package root with `*.spec.ts` naming
- **Coverage Target:** 80% minimum coverage for all packages
- **Mocking Library:** @vitest/spy 3.2+ and tinyspy 4.0+ for service mocking
- **Test Utilities:** jsdom 27.0+ for DOM testing

### E2E Testing
- **E2E Framework:** WebdriverIO (self-testing via example applications)
- **Example Apps:** Example applications using Electron Forge, Electron Builder, and unpackaged configurations
- **Test Coverage:** CJS/ESM, Forge/Builder, binary/no-binary, multiremote, standalone mode scenarios
- **CI Matrix:** Cross-platform testing on Windows, macOS, Linux (including Mac Universal builds)

## Code Quality and Linting

- **Formatter:** Biome 2.2.5 (format and lint)
- **Linter:** Biome 2.2.5 + ESLint 9.37+ with @typescript-eslint/parser 8.46+
- **ESLint Plugins:** @vitest/eslint-plugin, eslint-plugin-wdio
- **Pre-commit Hooks:** Husky 9.1+ with lint-staged 16.2+
- **Lint-Staged Config:** Auto-format and lint TypeScript files on commit

## Framework-Specific Dependencies

### Electron Service
- **Electron:** Peer dependency (any version, optional)
- **Electron Tooling:** @electron/fuses 2.0+, electron-to-chromium 1.5+
- **Build Tool Support:** @electron-forge/shared-types 7.10+, builder-util 26.0+ (dev)

### Main Process Access
- **AST Manipulation:** @babel/parser 7.28+, recast 0.23.9 (for code injection)
- **Browser Automation:** puppeteer-core 22.15+ (CDP interaction)
- **Version Comparison:** compare-versions 6.1+ (Electron version checks)

### API Mocking
- **Mock Implementation:** @vitest/spy 3.2+, tinyspy 4.0+
- **Deep Cloning:** fast-copy 3.0.2 (for mock state management)

## Utilities and Helpers

- **Logging:** @wdio/logger (WebdriverIO catalog version)
- **Port Management:** get-port 7.1+ (dynamic port allocation)
- **Package Reading:** read-package-up 11.0+ (detecting Electron/Tauri versions)
- **Debug Logging:** debug 4.4+ (service debugging)
- **Schema Validation:** Zod 3.x (configuration validation)

## CI/CD and DevOps

- **CI Platform:** GitHub Actions
- **CI Tasks:** Parallel unit, integration, package, and E2E tests
- **Build Verification:** Turbo pipeline for lint, format check, typecheck, test
- **Release Process:** Automated via turbo run release with concurrency control
- **Test Isolation:** Separate workspaces for E2E test scenarios
- **Cache Management:** Turbo daemon for build caching, eslintcache for lint caching

## Scripts and Automation

- **Script Runtime:** tsx 4.20+ (TypeScript script execution)
- **Task Graphs:** Custom scripts for visualizing E2E test dependencies
- **Shell Utilities:** shelljs 0.10+, shx 0.4+ (cross-platform shell operations)
- **Catalog Management:** Custom scripts for dependency catalog switching (default/next/minimum)
- **Backporting:** Custom backport script for version management

## Documentation and Examples

- **Documentation Format:** Markdown (docs/ directory)
- **Example Structure:** `examples/` directory with working sample applications
- **E2E Test Apps:** `e2e/` directory with comprehensive test scenarios
- **API Documentation:** TypeScript type definitions serve as API documentation

## Package Publishing

- **Registry:** PNPM (pnpm.io)
- **Package Scope:** `@wdio/*` scoped packages + `wdio-electron-service`
- **License:** MIT License (OpenJS Foundation)
- **Module Exports:** Conditional exports for ESM/CJS dual support
- **Type Definitions:** Included in package (`dist/esm/index.d.ts`, `dist/cjs/index.d.ts`)

## Future Framework Support

### Planned Additions

#### Flutter Service (Priority: High - Mobile + Desktop)
- **Framework:** Flutter (Dart-based) - Mobile (iOS/Android) + Desktop (Windows/macOS/Linux)
- **WebDriver Integration:** Appium Flutter Driver (existing JavaScript tooling)
- **Architecture:** WDIO → Appium Server → Appium Flutter Driver → Flutter Driver → Dart VM Service
- **Dependencies:**
  - `appium` (Appium 2.x server)
  - `appium-flutter-finder` (Element finding patterns)
  - Standard WebdriverIO Appium integration
- **Timeline:** 10-14 weeks (leverage existing Appium integration)
- **Unique Value:** Only framework with production-ready mobile testing support

#### Neutralino Service (Priority: High - Lightweight Desktop)
- **Framework:** Neutralino (C++ framework core with JavaScript client library)
- **Backend Architecture:** C++ core handles native operations, WebSocket IPC for communication
- **WebDriver Integration:** Platform-specific drivers (Windows/Linux) OR chrome mode (recommended)
- **Dependencies:**
  - `ws` (WebSocket client for backend API communication)
  - Platform WebDrivers: WebKitDriver (Linux), EdgeDriver (Windows), Chromedriver (chrome mode)
- **Extensions System:** Supports adding functionality in any language via WebSocket IPC
- **Timeline:** 13-17 weeks
- **Trade-off:** Desktop-only, but extremely lightweight (~3-5MB vs Electron's 150MB)

#### Tauri Service (Priority: Medium - Secure Desktop + Experimental Mobile)
- **Framework:** Tauri (Rust-based) - Desktop (Windows/macOS/Linux) + Mobile (iOS/Android experimental)
- **WebDriver Integration:** Official tauri-driver (WebDriver wrapper maintained by Tauri team)
- **Backend Access:** Standard Tauri commands (no special plugin required)
- **Dependencies:**
  - `tauri-driver` (official Tauri WebDriver server)
  - Platform WebDrivers (abstracted by tauri-driver)
- **Documentation:** Official WebdriverIO examples in Tauri v2 docs
- **Timeline:** 12-16 weeks (official tooling reduces complexity)
- **Trade-off:** Rust learning curve, but excellent security model

### Additional Dependencies

#### Mobile Testing (Flutter)
- **Appium Server:** Appium 2.x for mobile device automation
- **Device Drivers:**
  - iOS: XCUITest driver (via Appium)
  - Android: UiAutomator2 driver (via Appium)
- **Device Farms:** BrowserStack, Sauce Labs integration patterns

#### Platform-Specific WebDrivers
- **Windows:** Microsoft Edge Driver (for WebView2 in Neutralino/Tauri window mode)
- **Linux:** WebKitWebDriver (for webkit2gtk in Neutralino/Tauri window mode)
- **macOS:** Limited WKWebView support (recommend chrome mode for Neutralino/Tauri)
- **Universal:** Chromedriver (for chrome mode across all platforms)

#### Backend Communication
- **WebSocket Client:** For Neutralino C++ backend API communication
- **tauri-driver:** Official Tauri WebDriver server (replaces custom IPC bridge)
- **Appium Flutter Driver:** Pre-built driver for Flutter automation (no custom development needed)

## Version Catalog System

- **Catalog Files:** pnpm-workspace.yaml with dependency catalogs
- **Catalog Types:** default (stable), next (preview), minimum (compatibility testing)
- **Catalog Management:** Scripts to switch between catalogs and update dependencies
- **Dependency Overrides:** pnpm overrides for local package linking during development

---

## Changelog

### v1.1.0 (2025-10-20)
- **REVISION:** Updated future framework support section with corrected details
- **Flutter:** Clarified Appium integration (existing tooling, not new development)
- **Neutralino:** Corrected backend architecture (C++ core, not JavaScript)
- **Tauri:** Added official tauri-driver information, removed incorrect IPC bridge claims
- Updated priorities: Flutter and Neutralino as parallel high-priority (mobile + lightweight desktop)
- Added mobile testing dependencies and device farm integration notes
- Documented platform-specific WebDriver requirements

### v1.0.0 (2025-10-19)
- Initial version documenting complete tech stack for WebdriverIO cross-platform testing monorepo
- Documented TypeScript, pnpm, Turborepo, Vitest, Biome, and WebdriverIO core stack
- Included Electron service dependencies and architecture
- Added future framework support plans (Tauri, Flutter, Neutralino)
- Documented CI/CD, testing, and build tooling
