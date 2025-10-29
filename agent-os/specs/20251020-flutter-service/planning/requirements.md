# Requirements: Flutter Service Core Architecture

**Spec ID:** 20251020-flutter-service
**Roadmap Item:** #4
**Priority:** High (Mobile + Desktop)
**Estimated Effort:** Large (L)

## Overview

Implement `@wdio/flutter-service` as a convenience layer over existing Appium Flutter Driver integration, providing automatic binary detection, capability configuration, and WebdriverIO command wrappers for Flutter-specific interactions across iOS, Android, Windows, macOS, and Linux platforms.

## Context

**Flutter Framework:**
- **Frontend:** Skia canvas rendering (custom widgets, not HTML DOM)
- **Backend:** Dart runtime with platform channels
- **Automation:** Appium Flutter Driver (existing, production-ready)
- **Platforms:** 5 platforms (iOS, Android, Windows, macOS, Linux)

**Existing Integration:**
Flutter + Appium + WDIO works today - this service adds:
- Automatic configuration
- Binary detection
- Convenience commands
- Better developer experience

**Key Constraint:** This is NOT a replacement for Appium - it's a **convenience layer** that simplifies Flutter testing with WebdriverIO.

## Functional Requirements

### FR1: Appium Service Integration
**Priority:** Must Have
**Source:** Roadmap Item #4, Cross-Framework Analysis

Integrate with Appium Flutter Driver as the WebDriver provider:

- [ ] **Launcher Class:**
  - Extend `BaseLauncher` from `@wdio/native-utils`
  - Start/stop Appium server if not already running
  - Configure Appium capabilities automatically
  - Validate Appium Flutter Driver is installed
  - Support custom Appium server configuration

- [ ] **Appium Server Management:**
  - Detect if Appium server is already running (port check)
  - Start Appium server with appropriate configuration
  - Support custom Appium host/port
  - Clean shutdown of Appium server
  - Log Appium server output for debugging

- [ ] **Appium Flutter Driver Validation:**
  - Check if `appium-flutter-driver` is installed
  - Provide helpful error messages if missing
  - Suggest installation command if not found
  - Support version compatibility checking

**Configuration Example:**
```typescript
// wdio.conf.js
export const config = {
  services: [
    ['flutter', {
      appPath: './build/app.apk',
      platform: 'android',
      appiumPort: 4723,
      appiumHost: 'localhost',
      flutterDriverPort: 8181
    }]
  ]
};
```

### FR2: Flutter Binary Detection
**Priority:** Must Have
**Source:** Roadmap Item #4, Cross-Framework Analysis

Automatically detect Flutter application binaries across all platforms:

- [ ] **Binary Detection Framework:**
  - Use `BinaryDetector` from `@wdio/native-utils` as base
  - Implement Flutter-specific path generation
  - Support all 5 platforms

- [ ] **Platform-Specific Detection:**
  - **Android:** `build/app/outputs/flutter-apk/app-release.apk` (or debug variants)
  - **iOS:** `build/ios/iphoneos/Runner.app` (device builds) or `build/ios/iphonesimulator/Runner.app` (simulator)
  - **Windows:** `build/windows/runner/Release/` or `build/windows/x64/runner/Release/`
  - **macOS:** `build/macos/Build/Products/Release/AppName.app`
  - **Linux:** `build/linux/x64/release/bundle/` or `build/linux/arm64/release/bundle/`

- [ ] **Build Configuration Detection:**
  - Parse `pubspec.yaml` for app metadata
  - Detect debug vs release builds
  - Support custom output directories
  - Find build artifacts from Flutter CLI (`flutter build` outputs)

- [ ] **Validation:**
  - Verify binary exists and is executable
  - Check binary is not corrupted
  - Provide helpful error messages with suggestions
  - Support fallback to manual path configuration

**Example Usage:**
```typescript
// Auto-detection
services: [['flutter', { platform: 'android' }]]

// Manual override
services: [['flutter', {
  appPath: './custom/path/app.apk',
  platform: 'android'
}]]
```

### FR3: Capability Configuration
**Priority:** Must Have
**Source:** Roadmap Item #4

Automatically configure Appium capabilities for Flutter testing:

- [ ] **Platform-Specific Capabilities:**
  - **Android:**
    ```typescript
    {
      platformName: 'Android',
      'appium:automationName': 'Flutter',
      'appium:app': '/path/to/app.apk',
      'appium:deviceName': 'emulator-5554',
      'appium:retries': 0
    }
    ```
  - **iOS:**
    ```typescript
    {
      platformName: 'iOS',
      'appium:automationName': 'Flutter',
      'appium:app': '/path/to/Runner.app',
      'appium:deviceName': 'iPhone Simulator',
      'appium:platformVersion': '15.0'
    }
    ```
  - **Desktop (Windows/macOS/Linux):**
    ```typescript
    {
      platformName: 'Desktop',
      'appium:automationName': 'Flutter',
      'appium:app': '/path/to/app'
    }
    ```

- [ ] **Capability Merging:**
  - Service-level configuration (defaults)
  - Capability-level configuration (overrides)
  - User-provided capabilities (highest priority)
  - Sensible defaults for each platform

- [ ] **Device Configuration:**
  - Auto-detect available devices/emulators
  - Support device UDID specification
  - Support platform version specification
  - Handle multiple devices gracefully

- [ ] **Flutter Driver Configuration:**
  - Configure Flutter Driver port (default: 8181)
  - Support custom observatory port
  - Enable Flutter Driver logging
  - Configure retries and timeouts

### FR4: Core Flutter Commands
**Priority:** Must Have
**Source:** Roadmap Item #4, Cross-Framework Analysis

Provide WebdriverIO command wrappers for Flutter-specific interactions:

- [ ] **Element Finding Commands:**
  - `browser.flutter.byValueKey(key)` - Find by ValueKey
  - `browser.flutter.byType(type)` - Find by widget type
  - `browser.flutter.byText(text)` - Find by text
  - `browser.flutter.bySemanticsLabel(label)` - Find by semantics label
  - `browser.flutter.byTooltip(tooltip)` - Find by tooltip

- [ ] **Interaction Commands:**
  - `browser.flutter.tap(finder)` - Tap widget
  - `browser.flutter.enterText(finder, text)` - Enter text in field
  - `browser.flutter.scroll(finder, options)` - Scroll widget
  - `browser.flutter.scrollUntilVisible(finder, scrollable)` - Scroll until visible
  - `browser.flutter.drag(finder, offset)` - Drag widget
  - `browser.flutter.longPress(finder)` - Long press widget

- [ ] **Waiting Commands:**
  - `browser.flutter.waitForWidget(finder, timeout)` - Wait for widget
  - `browser.flutter.waitForAbsent(finder, timeout)` - Wait for absence
  - `browser.flutter.waitUntilNoTransientCallbacks()` - Wait for animations

- [ ] **Assertion Commands:**
  - `browser.flutter.getText(finder)` - Get widget text
  - `browser.flutter.isPresent(finder)` - Check if widget exists
  - `browser.flutter.isVisible(finder)` - Check visibility
  - `browser.flutter.getWidgetTree()` - Get widget tree (debugging)

**Implementation Pattern:**
```typescript
// Wraps appium-flutter-finder
import { byValueKey } from 'appium-flutter-finder';

async function tap(key: string): Promise<void> {
  const element = byValueKey(key);
  await driver.elementClick(element);
}
```

### FR5: Service Lifecycle Integration
**Priority:** Must Have
**Source:** Item #3 (Shared Core Utilities)

Integrate with WebdriverIO service lifecycle:

- [ ] **Launcher Hooks:**
  - `onPrepare(config, capabilities)` - Start Appium, configure capabilities
  - `onComplete()` - Stop Appium server

- [ ] **Worker Service Hooks:**
  - `before(capabilities, specs, browser)` - Register Flutter commands
  - `after(result)` - Cleanup per worker
  - `beforeCommand(commandName, args)` - Logging/debugging
  - `afterCommand(commandName, args, result)` - Error handling

- [ ] **Command Registration:**
  - Register all Flutter commands on `browser.flutter` namespace
  - Support custom command registration
  - Avoid conflicts with existing WebdriverIO commands

- [ ] **Error Handling:**
  - Wrap Appium errors with helpful messages
  - Detect common Flutter-specific errors
  - Provide troubleshooting suggestions
  - Log errors with context

### FR6: Multi-Platform Support
**Priority:** Must Have
**Source:** Roadmap Item #4, Cross-Framework Analysis

Support all 5 Flutter platforms with platform-specific configurations:

- [ ] **Platform Detection:**
  - Auto-detect target platform from app path or configuration
  - Support explicit platform specification
  - Validate platform compatibility
  - Provide platform-specific defaults

- [ ] **Mobile Platform Support:**
  - **iOS:** Simulator + real device support
  - **Android:** Emulator + real device support
  - Handle mobile-specific capabilities (device UDID, platform version)
  - Support mobile gestures (swipe, pinch, rotate)

- [ ] **Desktop Platform Support:**
  - **Windows:** x64 and arm64 builds
  - **macOS:** Intel and Apple Silicon builds
  - **Linux:** x64 and arm64 builds
  - Handle desktop-specific interactions

- [ ] **Platform Utilities:**
  - `getPlatformCapabilities(platform)` - Get default capabilities
  - `detectPlatformFromApp(appPath)` - Infer platform from binary
  - `validatePlatformSupport(platform)` - Check if supported
  - Platform-specific error messages

### FR7: Configuration Management
**Priority:** Must Have
**Source:** Item #3 (Shared Core Utilities)

Comprehensive configuration management:

- [ ] **Configuration Schema:**
  - Define TypeScript interfaces for all config options
  - Validate configuration with Zod or similar
  - Provide sensible defaults
  - Document all options

- [ ] **Configuration Sources:**
  - Service-level config (wdio.conf.js)
  - Capability-level config (per test)
  - Environment variables (CI/CD)
  - Flutter project config (pubspec.yaml)

- [ ] **Configuration Options:**
  ```typescript
  interface FlutterServiceOptions {
    // Binary detection
    appPath?: string;
    platform: 'android' | 'ios' | 'windows' | 'macos' | 'linux';
    buildMode?: 'debug' | 'release' | 'profile';

    // Appium configuration
    appiumHost?: string;
    appiumPort?: number;
    appiumPath?: string;
    appiumLogLevel?: string;

    // Flutter Driver configuration
    flutterDriverPort?: number;
    observatoryPort?: number;
    enableFlutterDriverLog?: boolean;

    // Device configuration
    deviceName?: string;
    deviceUdid?: string;
    platformVersion?: string;

    // Timeouts
    commandTimeout?: number;
    elementTimeout?: number;

    // Advanced
    customCapabilities?: Record<string, any>;
    skipAppiumInstallCheck?: boolean;
  }
  ```

- [ ] **Configuration Validation:**
  - Required fields checked
  - Type validation
  - Platform-specific validation
  - Helpful error messages

### FR8: Logging and Debugging
**Priority:** Should Have
**Source:** Item #3 (Shared Core Utilities)

Comprehensive logging for debugging:

- [ ] **Logger Integration:**
  - Use `@wdio/logger` for consistent logging
  - Scoped logger: `@wdio/flutter-service`
  - Support log levels (trace, debug, info, warn, error)

- [ ] **Debug Information:**
  - Log Appium server start/stop
  - Log capability configuration
  - Log Flutter command execution
  - Log widget tree on errors (optional)
  - Log platform detection results

- [ ] **Debug Mode:**
  - Enable via environment variable or config
  - Verbose Appium logging
  - Save screenshots on failures
  - Dump widget tree on errors

### FR9: Package and E2E Tests (Ported from Electron)
**Priority:** Must Have
**Source:** Electron service test patterns

Implement comprehensive testing matching Electron service coverage:

- [ ] **Package Tests** (matching `packages/wdio-electron-service/test/` patterns):
  - Launcher lifecycle tests (ported from `launcher.spec.ts`)
  - Service lifecycle tests (ported from `service.spec.ts`)
  - Binary detection tests for all 5 platforms (ported from `pathResolver.spec.ts`)
  - Capability configuration tests (ported from `capabilities.spec.ts`)
  - Command tests (ported from `commands/*.spec.ts`)
  - Session and connection management tests
  - Platform-specific tests (mobile device handling, desktop window management)
  - Error handling and validation tests

- [ ] **E2E Tests** (matching `e2e/test/` patterns):
  - Application launch tests (ported from `application.spec.ts`)
  - Flutter command execution tests (adapted from `api.spec.ts`)
  - Window management tests (ported from `window.spec.ts`)
  - Interaction tests (adapted from `interaction.spec.ts`)
  - Multiremote mode tests (ported from `multiremote/api.spec.ts`)
  - Standalone mode tests (ported from `standalone/api.spec.ts`)
  - Platform-specific scenarios (mobile gestures, desktop interactions)

- [ ] **Test Fixtures** (matching `fixtures/` structure):
  - E2E test apps for all 5 platforms (`fixtures/flutter-apps/`)
  - Package test scenarios (`fixtures/flutter-package-tests/`)
  - Configuration variations (`fixtures/flutter-config-scenarios/`)

- [ ] **Test Coverage Targets:**
  - 80%+ package test coverage (matching Electron)
  - Comprehensive E2E coverage (all critical user paths)
  - Multi-platform CI validation (Android, iOS, Windows, macOS, Linux)

**Test Reuse Pattern:**
```typescript
// High reuse (70-90%): Launcher/Service lifecycle
// Adapt from Electron launcher.spec.ts
describe('FlutterLauncher', () => {
  it('should configure capabilities in onPrepare', async () => {
    // Same test pattern, different capability values
  });
});

// Medium reuse (40-60%): Binary detection
// Adapt from Electron pathResolver.spec.ts
describe('FlutterBinaryDetector', () => {
  it('should detect Android APK', async () => {
    // Same pattern (mock file system), different paths
  });
});

// Low reuse (10-30%): Framework-specific features
// New tests for Flutter Driver commands via Appium
describe('Flutter Commands', () => {
  it('should execute tap via Appium', async () => {
    // Flutter-specific via appium-flutter-finder
  });
});
```

### FR10: Example Applications and Test Apps
**Priority:** Must Have
**Source:** Best practices (examples validate functionality)

Provide example Flutter applications for all platforms:

- [ ] **Mobile Examples:**
  - Android example app with tests
  - iOS example app with tests
  - Configure for both simulator and real devices

- [ ] **Desktop Examples:**
  - Windows example app with tests
  - macOS example app with tests
  - Linux example app with tests

- [ ] **Example Features:**
  - Basic widget interactions
  - Text input and validation
  - Scrolling and lists
  - Navigation between screens
  - Platform-specific features

- [ ] **Example Tests:**
  - Element finding patterns
  - User flow testing
  - Multi-platform compatibility
  - Configuration examples

**Example Location:**
```
fixtures/flutter-apps/
├── mobile/
│   ├── android/
│   └── ios/
├── desktop/
│   ├── windows/
│   ├── macos/
│   └── linux/
└── test/
    └── specs/
        └── flutter.e2e.ts
```

## Technical Requirements

### TR1: Package Structure
**Priority:** Must Have

```
packages/@wdio/flutter-service/
├── src/
│   ├── index.ts                    # Main exports
│   ├── launcher.ts                 # FlutterLauncher class
│   ├── service.ts                  # FlutterService class
│   ├── binary-detection/
│   │   ├── FlutterBinaryDetector.ts
│   │   └── PlatformPaths.ts
│   ├── capabilities/
│   │   ├── CapabilityBuilder.ts
│   │   └── PlatformCapabilities.ts
│   ├── commands/
│   │   ├── finder.ts               # Element finding
│   │   ├── interaction.ts          # Tap, scroll, etc.
│   │   ├── waiting.ts              # Wait commands
│   │   └── assertion.ts            # Assertions
│   ├── appium/
│   │   ├── AppiumManager.ts        # Start/stop Appium
│   │   └── DriverValidator.ts      # Check driver installed
│   ├── configuration/
│   │   ├── ConfigSchema.ts
│   │   └── ConfigValidator.ts
│   └── utils/
│       ├── PlatformDetector.ts
│       └── Logger.ts
├── test/
│   ├── unit/
│   │   └── **/*.spec.ts
│   └── integration/
│       └── **/*.spec.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### TR2: Dependencies
**Priority:** Must Have

**Peer Dependencies:**
- `webdriverio` ^9.0.0
- `appium` ^2.0.0

**Dependencies:**
- `@wdio/native-utils` workspace:* (from Item #3)
- `@wdio/logger` (catalog version)
- `appium-flutter-finder` ^1.5.0
- `zod` - Schema validation
- `get-port` - Find available ports

**Dev Dependencies:**
- `vitest` - Testing
- `@vitest/coverage-v8` - Coverage
- `@types/node` - TypeScript types
- Standard monorepo dev deps

### TR3: TypeScript Configuration
**Priority:** Must Have

- [ ] Strict mode enabled
- [ ] Declaration files generated
- [ ] Dual ESM/CJS builds
- [ ] Proper exports in package.json
- [ ] Use shared TypeScript config from monorepo

### TR4: Testing Requirements
**Priority:** Must Have

- [ ] 80%+ code coverage
- [ ] Unit tests for all utilities
- [ ] Integration tests with Appium
- [ ] Example app tests (E2E validation)
- [ ] Multi-platform CI testing

**Test Types:**
- Binary detection tests (mock file system)
- Capability configuration tests
- Command wrapper tests (mock Appium driver)
- Appium server management tests
- Configuration validation tests

### TR5: CI/CD Requirements
**Priority:** Must Have
**Source:** Item #1 (Monorepo Foundation establishes CI patterns)

Set up comprehensive CI/CD for multi-platform Flutter testing:

- [ ] **CI Platform:** GitHub Actions (following monorepo patterns from Item #1)

- [ ] **Platform Matrix:**
  - **Mobile:**
    - Android: ubuntu-latest with Android emulator (API 29+)
    - iOS: macos-latest with iOS simulator (iOS 15+)
  - **Desktop:**
    - Windows: windows-latest (x64 builds)
    - macOS: macos-latest (Intel and Apple Silicon)
    - Linux: ubuntu-latest (x64 builds)

- [ ] **Test Jobs:**
  - Package tests on all platforms (unit + integration)
  - E2E tests on all platforms (with platform-specific apps)
  - Coverage reporting and enforcement (80%+)
  - Lint and type-check (inherited from monorepo)

- [ ] **Appium in CI:**
  - Install and configure Appium server in CI
  - Install appium-flutter-driver
  - Start Appium before tests
  - Configure appropriate timeouts for CI environment

- [ ] **Mobile Emulator Setup:**
  - Android: Set up AVD (Android Virtual Device)
  - iOS: Use pre-installed simulator on macos runners
  - Configure emulator startup and health checks
  - Handle CI-specific timing issues

- [ ] **Caching Strategy:**
  - Cache Appium installation
  - Cache Flutter SDK
  - Cache platform-specific build tools
  - Leverage Turborepo remote caching (from Item #1)

- [ ] **Build Artifacts:**
  - Build Flutter apps for all platforms in CI
  - Cache built apps between test runs
  - Upload test results and coverage reports
  - Generate platform-specific build logs

**CI Workflow Example:**
```yaml
name: Flutter Service CI

on: [push, pull_request]

jobs:
  test-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Flutter
      - name: Setup Appium
      - name: Start Android Emulator
      - name: Build Flutter Android app
      - name: Run package tests
      - name: Run E2E tests
      - name: Upload coverage

  test-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Flutter
      - name: Setup Appium
      - name: Start iOS Simulator
      - name: Build Flutter iOS app
      - name: Run package tests
      - name: Run E2E tests
      - name: Upload coverage

  test-desktop:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - name: Setup Flutter
      - name: Setup Appium
      - name: Build Flutter desktop app
      - name: Run package tests
      - name: Run E2E tests
      - name: Upload coverage
```

### TR6: Documentation Requirements
**Priority:** Must Have

- [ ] Comprehensive README
  - Quick start guide
  - Installation instructions
  - Platform-specific setup
  - Configuration reference
  - Command API documentation

- [ ] API Documentation (JSDoc)
  - All public methods documented
  - TypeScript types as documentation
  - Code examples for each command

- [ ] Migration Guides
  - From pure Appium setup
  - From other testing frameworks
  - Platform-specific migration notes

- [ ] Troubleshooting Guide
  - Common errors and solutions
  - Platform-specific issues
  - Appium driver installation
  - Flutter Driver setup

## Non-Functional Requirements

### NFR1: Developer Experience
**Priority:** Must Have

- [ ] Simple configuration (minimal boilerplate)
- [ ] Automatic setup where possible
- [ ] Clear error messages with solutions
- [ ] IntelliSense support (TypeScript)
- [ ] Comprehensive examples

**Example - Before (Pure Appium):**
```javascript
// 20+ lines of boilerplate
import { byValueKey } from 'appium-flutter-finder';

export const config = {
  port: 4723,
  services: ['appium'],
  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'Flutter',
    'appium:app': '/Users/me/project/build/app/outputs/flutter-apk/app-release.apk',
    'appium:deviceName': 'emulator-5554',
    'appium:retries': 0
  }]
};

// In tests
const element = byValueKey('loginButton');
await driver.elementClick(element);
```

**Example - After (@wdio/flutter-service):**
```javascript
// Simple configuration
export const config = {
  services: [
    ['flutter', {
      platform: 'android'  // Auto-detects app path
    }]
  ]
};

// In tests
await browser.flutter.tap('loginButton');  // Simple API
```

### NFR2: Performance
**Priority:** Should Have

- [ ] Fast Appium server startup
- [ ] Minimal overhead over pure Appium
- [ ] Efficient binary detection (caching)
- [ ] No unnecessary command wrapping overhead

### NFR3: Reliability
**Priority:** Must Have

- [ ] Robust error handling
- [ ] Retry logic for flaky operations
- [ ] Graceful degradation
- [ ] Clean resource cleanup

### NFR4: Compatibility
**Priority:** Must Have

- [ ] Appium 2.x support
- [ ] WebdriverIO 9.x support
- [ ] Node.js 18+ (LTS versions)
- [ ] Flutter 3.0+ compatibility
- [ ] All 5 platforms validated

### NFR5: Maintainability
**Priority:** Must Have

- [ ] Clear separation of concerns
- [ ] Well-documented code
- [ ] Consistent coding patterns
- [ ] Easy to extend for new platforms
- [ ] Follows monorepo conventions

## Implementation Strategy

### Phase 0: Test Analysis and Porting Strategy (1 week)
**Priority:** Must Have
**Source:** Electron service test patterns

Analyze Electron service tests to establish reusable patterns and identify Flutter-specific adaptations needed.

- [ ] **Analyze Electron Package Tests:**
  - Review all test files in `packages/wdio-electron-service/test/`
  - Categorize by reusability: High (70-90%), Medium (40-60%), Low (10-30%)
  - Document test patterns applicable to all services
  - Identify framework-specific patterns requiring adaptation

- [ ] **Analyze Electron E2E Tests:**
  - Review `e2e/test/` structure and coverage
  - Map E2E scenarios to Flutter equivalents:
    - Application launch → Flutter app launch via Appium
    - API execution (CDP) → Flutter Driver commands via Appium
    - Mocking (CDP dual mock) → Flutter dependency injection patterns
    - Window management → Flutter desktop window APIs
    - Multiremote/Standalone → Reusable patterns
  - Document platform-specific adjustments needed
  - Identify mobile-specific test scenarios (iOS/Android)

- [ ] **Design Test Porting Strategy:**
  - Create test reuse matrix (copy/adapt/create new)
  - Plan shared test utilities location (@wdio/native-utils or new package)
  - Design Flutter fixture structure:
    - `fixtures/flutter-apps/` - Android, iOS, Windows, macOS, Linux apps
    - `fixtures/flutter-package-tests/` - Flutter app scenarios
    - `fixtures/flutter-config-scenarios/` - pubspec.yaml variations
  - Define test coverage targets matching Electron (80%+ package, comprehensive E2E)

- [ ] **Document Findings:**
  - Create test porting guide (Electron → Flutter patterns)
  - Document shared test utilities design
  - Share findings for Neutralino/Tauri spec planning
  - Establish test coverage equivalence criteria

**Deliverables:**
- Test reuse matrix document
- Test porting guide
- Fixture structure plan
- Shared test utilities design
- Coverage targets defined

### Phase 1: Foundation (2-3 weeks)
**Priority:** Must Have

- [ ] Package structure setup
- [ ] Extend `BaseLauncher` and `BaseService` from `@wdio/native-utils`
- [ ] Appium server management
- [ ] Basic capability configuration
- [ ] Unit test framework setup
- [ ] **Package tests:** Launcher lifecycle, service lifecycle (ported from Electron patterns)

**Deliverables:**
- Package scaffolding
- Appium integration working
- Basic tests passing (including launcher/service tests)
- CI/CD integration

### Phase 2: Binary Detection (2-3 weeks)
**Priority:** Must Have

- [ ] Implement `FlutterBinaryDetector`
- [ ] Platform-specific path resolution
- [ ] Parse `pubspec.yaml` for metadata
- [ ] Validation and error messages
- [ ] **Package tests:** Binary detection for all 5 platforms (ported from Electron pathResolver patterns)

**Deliverables:**
- Auto-detection working for all 5 platforms
- Manual override support
- Comprehensive tests (binary detection patterns)
- Documentation

### Phase 3: Core Commands (3-4 weeks)
**Priority:** Must Have

- [ ] Integrate `appium-flutter-finder`
- [ ] Implement element finding commands
- [ ] Implement interaction commands
- [ ] Implement waiting commands
- [ ] Implement assertion commands
- [ ] Command registration on `browser.flutter`
- [ ] **Package tests:** Command tests (adapted from Electron command patterns)

**Deliverables:**
- All core commands implemented
- Unit tests for each command
- Integration tests with mock Appium driver
- API documentation

### Phase 4: Multi-Platform Support (2-3 weeks)
**Priority:** Must Have

- [ ] Platform-specific capability builders
- [ ] Mobile platform configuration (iOS, Android)
- [ ] Desktop platform configuration (Windows, macOS, Linux)
- [ ] Platform detection utilities
- [ ] Platform-specific error handling
- [ ] **Package tests:** Capability configuration for all platforms (ported from Electron capability patterns)

**Deliverables:**
- All platforms supported
- Platform detection working
- Platform-specific tests (capability builders)
- Platform documentation

### Phase 5: Example Apps and Test Fixtures (2-3 weeks)
**Priority:** Must Have

- [ ] Create E2E test apps for all 5 platforms (based on fixture structure from Phase 0)
- [ ] Create package test fixtures (Flutter scenarios, config variations)
- [ ] Set up test infrastructure for E2E and package tests
- [ ] Configure multi-platform CI for E2E tests

**Deliverables:**
- 5 E2E test apps in `fixtures/flutter-apps/`:
  - `android-app/` - Android test app
  - `ios-app/` - iOS test app
  - `windows-app/` - Windows test app
  - `macos-app/` - macOS test app
  - `linux-app/` - Linux test app
- Package test fixtures in `fixtures/flutter-package-tests/`
- Test infrastructure ready

### Phase 6: E2E and Package Testing (2-3 weeks)
**Priority:** Must Have
**Source:** Ported from Electron E2E patterns (Phase 0 analysis)

Implement comprehensive E2E and package tests matching Electron service coverage:

- [ ] **E2E Tests** (ported from `e2e/test/` patterns):
  - Application launch tests (5 platforms)
  - Flutter command tests (tap, scroll, waitForWidget, etc.)
  - Window management tests (desktop platforms)
  - Multiremote mode tests
  - Standalone mode tests
  - Platform-specific feature tests (mobile gestures, desktop interactions)

- [ ] **Package Tests** (ported from `fixtures/package-tests/` patterns):
  - Test against real Flutter apps (all 5 platforms)
  - Build tool integration tests (Flutter CLI)
  - Configuration scenario tests (pubspec.yaml variations)
  - Platform-specific build tests

- [ ] **Integration Testing:**
  - Full Appium integration workflows
  - Binary detection → Capability config → App launch → Command execution
  - Error handling and recovery scenarios
  - CI/CD pipeline validation

**Deliverables:**
- Comprehensive E2E test suite (matching Electron coverage)
- Package tests for all platforms
- Multi-platform CI passing
- Test documentation

### Phase 7: Documentation and Migration Guides (1-2 weeks)
**Priority:** Must Have

- [ ] Complete README with quick start
- [ ] API documentation (JSDoc)
- [ ] Platform setup guides (all 5 platforms)
- [ ] Migration guide from pure Appium
- [ ] Troubleshooting guide
- [ ] Test porting guide (for Neutralino/Tauri teams)

**Deliverables:**
- Complete documentation
- Migration guides
- Test reuse documentation for downstream services

## Dependencies

### Upstream Dependencies
- ✅ **Required:** Item #1 (Monorepo Foundation with Electron Service) - MUST be complete
  - Provides: Monorepo infrastructure, CI/CD patterns, reference implementation
- ✅ **Required:** Item #2 (Shared Core Utilities) - MUST be complete
  - Provides: Reusable utilities (BaseLauncher, BaseService, BinaryDetector, etc.)

### Downstream Dependencies
- **Item #4:** Flutter Service Widget Testing Integration - Builds on this
- **Items #5-8:** Neutralino/Tauri Services - Will reuse test patterns from Phase 0 analysis
- **Item #9:** Shared Test Utilities - Will extract common test patterns for reuse

### Parallel Development
- **Items #5-6:** Neutralino Service - Can develop in parallel

## Reference Materials

### External Documentation
- **Appium Flutter Driver:** https://github.com/appium-flutter-driver/appium-flutter-driver
- **appium-flutter-finder:** https://github.com/truongsinh/appium-flutter-finder
- **Flutter Documentation:** https://flutter.dev/docs
- **Appium Documentation:** https://appium.io/docs/en/2.0/

### Product Documentation
- `/agent-os/product/roadmap.md`
- `/agent-os/product/tech-stack.md`
- `/agent-os/product/cross-framework-analysis.md` - Flutter section

### Previous Specs
- Item #2: Electron Service Migration (reference patterns)
- Item #3: Shared Core Utilities (reusable components)

## Success Criteria

The Flutter service is complete when:

1. ✅ **Package created:**
   - `@wdio/flutter-service` in packages directory
   - 80%+ test coverage
   - Documentation complete

2. ✅ **Appium integration functional:**
   - Appium server management working
   - Capability configuration automatic
   - Flutter Driver connection reliable

3. ✅ **Binary detection working:**
   - Auto-detects Flutter apps on all 5 platforms
   - Handles debug and release builds
   - Clear error messages on failure

4. ✅ **Commands implemented:**
   - All core Flutter commands working
   - Registered on `browser.flutter` namespace
   - Well-documented with examples

5. ✅ **Multi-platform support:**
   - iOS and Android (mobile) working
   - Windows, macOS, Linux (desktop) working
   - Platform-specific features validated

6. ✅ **Examples complete:**
   - Example app for each platform
   - Comprehensive test suites
   - Documentation and guides

7. ✅ **Quality standards:**
   - Passes all lint/type checks
   - 80%+ coverage
   - CI/CD passing on all platforms

## Out of Scope

- Widget testing integration (that's Item #5)
- Screenshot comparison (that's Item #5)
- Advanced gestures beyond basic mobile support (that's Item #5)
- Custom Appium plugins
- Flutter Driver protocol implementation (use existing)
- Support for Flutter versions < 3.0

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Appium Flutter Driver changes | Medium | Pin driver version, monitor releases |
| Platform-specific Appium issues | Medium | Comprehensive platform testing in CI |
| Flutter build output changes | Low | Test against multiple Flutter versions |
| Mobile device configuration complexity | Medium | Excellent docs and examples |
| Desktop platform differences | Medium | Platform-specific configuration helpers |

## Questions for Clarification

1. Should we support Flutter versions < 3.0, or require 3.0+?
2. Should we bundle Appium server, or require external installation?
3. What mobile devices should be tested in CI (emulators only, or real devices)?
4. Should we provide device farm integration (BrowserStack, Sauce Labs)?

## Acceptance Criteria

- [ ] `@wdio/flutter-service` package created and published to monorepo
- [ ] Appium server management implemented
- [ ] Binary detection working for all 5 platforms
- [ ] Capability configuration automatic
- [ ] All core Flutter commands implemented
- [ ] Multi-platform support validated
- [ ] 80%+ test coverage achieved
- [ ] Comprehensive documentation written
- [ ] Example apps created for all platforms
- [ ] All example tests passing
- [ ] CI/CD running on all platforms
- [ ] Ready for Item #5 (Widget Testing Integration)
