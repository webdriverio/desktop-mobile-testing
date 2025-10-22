# Requirements: Shared Core Utilities Package

**Spec ID:** 20251020-shared-core-utilities
**Roadmap Item:** #3
**Priority:** High (Enables code reuse)
**Estimated Effort:** Medium (M)

## Overview

Extract common functionality from the migrated Electron service (Item #2) into a shared `@wdio/native-utils` package that provides reusable utilities for Flutter, Neutralino, and Tauri service implementations.

## Context

**Source:** Migrated Electron service packages (Item #2)
- `@wdio_electron-utils` - Contains patterns to generalize
- `wdio-electron-service` - Contains service lifecycle patterns

**Target Users:**
- Item #4: Flutter Service developers
- Item #6: Neutralino Service developers
- Item #8: Tauri Service developers

**Goal:** Enable 50%+ code reuse across service implementations by providing common abstractions.

## Functional Requirements

### FR1: Binary Path Resolution Framework
**Priority:** Must Have
**Source:** Electron service binary detection (`@wdio_electron-utils`)

Provide a framework-agnostic binary path resolution system:

- [ ] **Abstract Binary Detector Interface:**
  - `detectBinaryPath(options)` - Main entry point
  - `generatePossiblePaths()` - Framework-specific path generation
  - `validatePath(path)` - Cross-platform path validation
  - `getBuildToolConfig()` - Read framework build tool config

- [ ] **Platform Utilities:**
  - `getPlatformBinaryExtension()` - `.exe` on Windows, `.app` on macOS, none on Linux
  - `getPlatformArchitecture()` - x64, arm64, etc.
  - `normalizePath()` - Cross-platform path normalization

- [ ] **Build Tool Config Parsers:**
  - Base config reader (JSON, YAML, TOML support)
  - Extensible for framework-specific configs:
    - Electron: package.json, forge.config.js, electron-builder.{json,yaml}
    - Flutter: pubspec.yaml
    - Neutralino: neutralino.config.json
    - Tauri: tauri.conf.json

- [ ] **Validation Utilities:**
  - File existence checks
  - Execute permission checks
  - Error messages with suggestions

**Reusability Pattern:**
```typescript
// Framework-agnostic base
import { BinaryDetector, BuildToolConfig } from '@wdio/native-utils'

// Framework-specific implementation
class ElectronBinaryDetector extends BinaryDetector {
  protected generatePossiblePaths(config: BuildToolConfig): string[] {
    // Electron-specific logic
  }
}
```

### FR2: Service Lifecycle Abstractions
**Priority:** Must Have
**Source:** Electron service patterns (`wdio-electron-service`)

Provide base classes and interfaces for service implementation:

- [ ] **Base Launcher Class:**
  - `onPrepare(config, capabilities)` - Setup before workers
  - `onComplete()` - Cleanup after all tests
  - Capability configuration helpers
  - Port allocation utilities

- [ ] **Base Worker Service Class:**
  - `before(capabilities, specs, browser)` - Setup per worker
  - `after(result)` - Cleanup per worker
  - `beforeCommand(commandName, args)` - Hook before commands
  - `afterCommand(commandName, args, result)` - Hook after commands

- [ ] **Service Configuration Management:**
  - Merge service-level and capability-level config
  - Validate required options
  - Provide sensible defaults
  - Type-safe configuration interfaces

- [ ] **Command Registration Helpers:**
  - `registerBrowserCommand(name, fn)` - Add custom commands
  - `registerElementCommand(name, fn)` - Element commands
  - `overwriteCommand(name, fn)` - Override existing commands

**Example Usage:**
```typescript
import { BaseLauncher, BaseService } from '@wdio/native-utils'

export class FlutterLauncher extends BaseLauncher {
  async onPrepare(config, capabilities) {
    // Flutter-specific preparation
    await super.onPrepare(config, capabilities)
    // ...
  }
}

export class FlutterService extends BaseService {
  async before(caps, specs, browser) {
    await super.before(caps, specs, browser)
    // Register Flutter commands
    this.registerBrowserCommand('flutter', flutterCommands)
  }
}
```

### FR3: Window Management Abstractions
**Priority:** Should Have
**Source:** Electron service window management

Provide utilities for multi-window testing:

- [ ] **Window Handle Management:**
  - `getActiveWindowHandle()` - Detect active window
  - `getAllWindowHandles()` - List all windows
  - `switchToWindowSafely(handle)` - Switch with error handling

- [ ] **Window Focus Tracking:**
  - Base class for window focus management
  - Hooks for before/after command execution
  - Automatic focus switching logic

- [ ] **Multiremote Support Utilities:**
  - Helpers for managing multiple instances
  - Per-instance window tracking
  - Instance identification utilities

### FR4: Configuration Parsing Utilities
**Priority:** Must Have
**Source:** Electron service config parsing

Provide framework-agnostic configuration utilities:

- [ ] **Config File Readers:**
  - JSON reader with JSON5 support (comments)
  - YAML reader
  - TOML reader
  - JavaScript/TypeScript config file execution (via tsx)

- [ ] **Config Resolution:**
  - Find config file in project directory
  - Support multiple file name patterns
  - Support "extends" inheritance (like electron-builder)
  - Merge configurations with proper precedence

- [ ] **Config Validation:**
  - Schema validation (Zod or similar)
  - Required field checks
  - Type coercion and normalization
  - Helpful error messages

**Example API:**
```typescript
import { ConfigReader } from '@wdio/native-utils'

const reader = new ConfigReader({
  filePatterns: ['tauri.conf.json', '.taurirc.json'],
  schema: tauriConfigSchema
})

const config = await reader.read(projectRoot)
```

### FR5: Logging and Debugging Utilities
**Priority:** Should Have
**Source:** Electron service logging patterns

- [ ] **Logger Factory:**
  - Create scoped loggers per service
  - Integrate with `@wdio/logger`
  - Support different log levels
  - Structured logging support

- [ ] **Debug Utilities:**
  - Environment-based debug mode
  - Performance timing utilities
  - Diagnostic information helpers

### FR6: Platform Detection Utilities
**Priority:** Must Have
**Source:** Electron service platform handling

- [ ] **Platform Information:**
  - `getCurrentPlatform()` - darwin, win32, linux
  - `getPlatformName()` - macOS, Windows, Linux (display names)
  - `isCI()` - Detect CI environment
  - `getNodeVersion()` - Runtime information

- [ ] **Platform-Specific Helpers:**
  - Path separators handling
  - Line ending normalization
  - Environment variable access

### FR7: Testing Utilities
**Priority:** Should Have
**Source:** Test patterns from Electron service

- [ ] **Mock Helpers:**
  - Mock command registration
  - Mock browser object creation
  - Common test fixtures

- [ ] **Test Matchers:**
  - Custom matchers for service testing
  - Path comparison utilities
  - Configuration assertion helpers

## Technical Requirements

### TR1: Package Structure
**Priority:** Must Have

```
packages/@wdio/native-utils/
├── src/
│   ├── index.ts                  # Main exports
│   ├── binary-detection/
│   │   ├── BinaryDetector.ts     # Base class
│   │   ├── PathValidator.ts
│   │   └── PlatformUtils.ts
│   ├── service-lifecycle/
│   │   ├── BaseLauncher.ts
│   │   ├── BaseService.ts
│   │   └── CommandRegistry.ts
│   ├── window-management/
│   │   ├── WindowManager.ts
│   │   └── MultiremoteHelper.ts
│   ├── configuration/
│   │   ├── ConfigReader.ts
│   │   ├── ConfigMerger.ts
│   │   └── ConfigValidator.ts
│   ├── logging/
│   │   └── LoggerFactory.ts
│   ├── platform/
│   │   └── PlatformDetector.ts
│   └── testing/
│       └── MockHelpers.ts
├── test/
│   └── **/*.spec.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### TR2: Dependencies
**Priority:** Must Have

**Peer Dependencies:**
- `webdriverio` ^9.0.0
- `@wdio/logger` (catalog version)

**Dependencies:**
- `json5` - JSON with comments
- `yaml` - YAML parsing
- `smol-toml` - TOML parsing
- `tsx` - TypeScript execution (for JS/TS config files)
- `zod` (or similar) - Schema validation
- `debug` - Debug logging

**Dev Dependencies:**
- `vitest` - Testing
- `@vitest/coverage-v8` - Coverage
- Standard monorepo dev deps

### TR3: TypeScript Configuration
**Priority:** Must Have

- [ ] Strict mode enabled
- [ ] Declaration files generated
- [ ] Dual ESM/CJS builds
- [ ] Proper exports in package.json

### TR4: Testing Requirements
**Priority:** Must Have

- [ ] 80%+ code coverage
- [ ] Unit tests for all utilities
- [ ] Integration tests for common workflows
- [ ] Example usage tests

### TR5: Documentation Requirements
**Priority:** Must Have

- [ ] Comprehensive README with examples
- [ ] API documentation (JSDoc)
- [ ] Usage guides for each utility category
- [ ] Migration examples from Electron patterns

## Non-Functional Requirements

### NFR1: Reusability
**Priority:** Must Have

- [ ] Framework-agnostic design
- [ ] Clear extension points
- [ ] Minimal framework-specific assumptions
- [ ] Well-documented customization patterns

### NFR2: Performance
**Priority:** Should Have

- [ ] No performance overhead compared to Electron service
- [ ] Lazy loading where appropriate
- [ ] Minimal bundle size impact

### NFR3: Maintainability
**Priority:** Must Have

- [ ] Clear separation of concerns
- [ ] Well-documented code
- [ ] Consistent coding patterns
- [ ] Easy to extend for new frameworks

### NFR4: Backward Compatibility
**Priority:** Should Have

- [ ] Electron service continues to work (uses these utilities)
- [ ] Semver versioning
- [ ] Deprecation warnings for changes

## Extraction Strategy

### Phase 1: Identify Common Patterns
**Priority:** Must Have

Analyze Electron service to identify:
- [ ] Binary detection patterns (Forge, Builder, unpackaged)
- [ ] Service lifecycle methods
- [ ] Configuration parsing patterns
- [ ] Window management patterns
- [ ] Logging patterns

Document which parts are Electron-specific vs. generalizable.

### Phase 2: Create Abstractions
**Priority:** Must Have

- [ ] Design base classes and interfaces
- [ ] Create framework-agnostic utilities
- [ ] Write tests for new utilities
- [ ] Document extension points

### Phase 3: Refactor Electron Service
**Priority:** Must Have

- [ ] Update Electron service to use `@wdio/native-utils`
- [ ] Remove duplicated code
- [ ] Validate all Electron tests still pass
- [ ] Update Electron service documentation

### Phase 4: Validate with Prototypes
**Priority:** Should Have

- [ ] Create proof-of-concept for one other service (e.g., Flutter stub)
- [ ] Validate abstractions work for different framework
- [ ] Refine APIs based on findings

## Dependencies

### Upstream Dependencies
- ✅ **Required:** Item #1 (Monorepo Foundation) - MUST be complete
- ✅ **Required:** Item #2 (Electron Service Migration) - MUST be complete (source of code)

### Downstream Dependencies
- **Item #4:** Flutter Service - Will use these utilities
- **Item #6:** Neutralino Service - Will use these utilities
- **Item #8:** Tauri Service - Will use these utilities

## Reference Materials

### Source Code
**Location:** `/Users/sam/Workspace/wdio-desktop-mobile-testing/packages/`

**Packages to Extract From:**
- `@wdio_electron-utils` - Binary detection, platform utilities
- `wdio-electron-service` - Service lifecycle patterns
- `@wdio_electron-cdp-bridge` - May contain generalizable patterns

### Product Documentation
- `/agent-os/product/roadmap.md`
- `/agent-os/product/tech-stack.md`
- `/agent-os/product/cross-framework-analysis.md`
- Item #2 Spec: Electron Service Migration

### Cross-Framework Analysis
Reference patterns that differ between frameworks:
- **Binary Detection:** Each framework has different build tools and output structures
- **Backend Access:** Electron (CDP), Tauri (commands), Neutralino (WebSocket), Flutter (VM Service)
- **Window Management:** Similar patterns across frameworks
- **Configuration:** Different config file formats per framework

## Success Criteria

The shared utilities package is complete when:

1. ✅ **Package created:**
   - `@wdio/native-utils` in packages directory
   - 80%+ test coverage
   - Documentation complete

2. ✅ **Common utilities extracted:**
   - Binary path resolution framework
   - Service lifecycle abstractions
   - Window management utilities
   - Configuration parsing utilities
   - Platform detection utilities

3. ✅ **Electron service refactored:**
   - Uses `@wdio/native-utils`
   - All tests still pass
   - No duplicated code

4. ✅ **Validated for reuse:**
   - Clear extension points documented
   - Example usage for each utility
   - Ready for use in Items #4, #6, #8

5. ✅ **Quality standards:**
   - Passes all lint/type checks
   - 80%+ coverage
   - Well-documented APIs

## Out of Scope

- Framework-specific utilities (belong in service packages)
- CDP bridge abstractions (Electron-specific)
- API mocking system (Electron-specific pattern)
- Protocol bridge abstractions (each framework different)
- Chromedriver management (may be Electron-specific)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-abstraction | Medium | Start with concrete patterns, generalize incrementally |
| Breaking Electron service | High | Comprehensive test suite, validate after refactoring |
| Premature optimization | Low | Focus on reusability, not performance |
| API design mistakes | Medium | Validate with prototype implementation |

## Questions for Clarification

1. Should we wait to extract utilities until after implementing one non-Electron service (to validate patterns)?
2. How aggressively should we refactor Electron service to use new utilities?
3. Should we include Chromedriver management, or is that Electron-specific?
4. Should we extract logging patterns, or let each service implement their own?

## Acceptance Criteria

- [ ] `@wdio/native-utils` package created and published to monorepo
- [ ] Binary detection framework implemented and tested
- [ ] Service lifecycle base classes created
- [ ] Window management utilities extracted
- [ ] Configuration parsing utilities implemented
- [ ] Platform detection utilities created
- [ ] 80%+ test coverage achieved
- [ ] Comprehensive documentation written
- [ ] Electron service refactored to use utilities
- [ ] All Electron service tests still pass
- [ ] Example usage documented for Flutter/Neutralino/Tauri
- [ ] Ready for use in downstream service implementations
