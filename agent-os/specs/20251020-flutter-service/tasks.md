# Tasks: Flutter Service Core Architecture

**Spec ID:** 20251020-flutter-service
**Roadmap Item:** #4
**Priority:** High (Mobile + Desktop)
**Estimated Effort:** Large (L)
**Total Estimated Timeline:** 10-14 weeks (50-70 working days)
**Total Task Groups:** 9
**Total Sub-tasks:** 105

---

## Overview

This tasks breakdown implements `@wdio/flutter-service` as a convenience layer over Appium Flutter Driver, providing automatic binary detection, capability configuration, and WebdriverIO command wrappers for Flutter applications across all five platforms: iOS, Android, Windows, macOS, and Linux.

**Key Complexity Factors:**
- Multi-platform support (5 platforms with different binary formats and build outputs)
- External Appium dependency management
- Mobile device/emulator configuration
- Desktop platform differences (Intel/ARM, x64/arm64)
- Integration with existing Appium Flutter Driver ecosystem

**Implementation Phases (from spec):**
1. Foundation (2-3 weeks)
2. Binary Detection (2-3 weeks)
3. Core Commands (3-4 weeks)
4. Multi-Platform Support (2-3 weeks)
5. Examples and Documentation (2-3 weeks)

---

## Task Groups

### Task Group 1: Package Foundation and Structure (2-3 weeks)

**Assigned Implementer:** infrastructure-engineer
**Estimated Effort:** 10-15 days
**Dependencies:** Item #3 (Shared Core Utilities) MUST be complete
**Phase:** Foundation

#### Tasks

- [ ] **1.1: Initialize Package Structure**
  - **Effort:** 1 day
  - **Dependencies:** Monorepo foundation (Item #1)
  - **Description:**
    - Create `packages/@wdio/flutter-service/` directory structure
    - Set up `package.json` with scoped name `@wdio/flutter-service`
    - Configure TypeScript with strict mode and dual ESM/CJS builds
    - Set up Vitest for testing with coverage configuration
    - Configure Biome for linting
    - Add scripts for build, test, lint, type-check
  - **Acceptance Criteria:**
    - Package structure matches monorepo conventions
    - TypeScript compiles without errors
    - Build outputs to `dist/` with ESM and CJS formats
    - Declaration files (.d.ts) generated correctly
    - Package can be imported by other monorepo packages

- [ ] **1.2: Configure Package Dependencies**
  - **Effort:** 0.5 days
  - **Dependencies:** Task 1.1
  - **Description:**
    - Add peer dependencies: `webdriverio` ^9.0.0, `appium` ^2.0.0
    - Add workspace dependency: `@wdio/native-utils` workspace:*
    - Add direct dependencies: `@wdio/logger`, `appium-flutter-finder`, `yaml`, `zod`, `get-port`, `debug`
    - Add dev dependencies: `vitest`, `@vitest/coverage-v8`, TypeScript, Biome, types
    - Configure catalog versions where applicable
  - **Acceptance Criteria:**
    - All dependencies install without conflicts
    - Peer dependency warnings are appropriate
    - Workspace dependency resolves correctly
    - No security vulnerabilities in dependencies

- [ ] **1.3: Set Up Testing Infrastructure**
  - **Effort:** 1 day
  - **Dependencies:** Task 1.2
  - **Description:**
    - Write 2-5 focused tests for testing infrastructure setup
    - Configure Vitest with proper test patterns (`test/**/*.spec.ts`)
    - Set up coverage reporting with @vitest/coverage-v8 (80%+ target)
    - Create test utilities directory: `test/helpers/`
    - Create mock factories for Appium driver, Flutter config
    - Set up test fixtures for example pubspec.yaml files
    - Configure test timeouts and parallel execution
  - **Acceptance Criteria:**
    - Test infrastructure tests pass (2-5 tests)
    - `pnpm test` runs all tests successfully
    - `pnpm test:coverage` generates coverage report
    - Coverage threshold enforced (80%+)
    - Mock utilities available for other tests

- [ ] **1.4: Implement Base Service and Launcher Classes**
  - **Effort:** 2-3 days
  - **Dependencies:** Task 1.3, @wdio/native-utils complete
  - **Description:**
    - Write 3-6 focused tests for service/launcher lifecycle
    - Create `src/launcher.ts` extending `BaseLauncher` from `@wdio/native-utils`
    - Create `src/service.ts` extending `BaseService` from `@wdio/native-utils`
    - Implement `onPrepare` hook in launcher (scaffold)
    - Implement `before` hook in service for command registration (scaffold)
    - Implement `onComplete` cleanup hook in launcher
    - Implement `after` cleanup hook in service
    - Add TypeScript interfaces for options
    - Ensure service/launcher lifecycle tests pass (3-6 tests)
  - **Acceptance Criteria:**
    - Service/launcher lifecycle tests pass (3-6 tests)
    - FlutterLauncher extends BaseLauncher correctly
    - FlutterService extends BaseService correctly
    - Hooks called in proper order
    - No circular dependencies
    - TypeScript types exported correctly

- [ ] **1.5: Create Configuration Schema and Validation**
  - **Effort:** 2 days
  - **Dependencies:** Task 1.4
  - **Description:**
    - Write 3-6 focused tests for configuration validation
    - Create `src/configuration/ConfigSchema.ts` with Zod schema
    - Define `FlutterServiceOptions` interface matching all spec requirements
    - Implement platform enum validation (android, ios, windows, macos, linux)
    - Implement build mode validation (debug, release, profile)
    - Create `src/configuration/ConfigValidator.ts` for validation logic
    - Create `src/configuration/ConfigMerger.ts` for merging configurations
    - Add helpful error messages for validation failures
    - Ensure configuration validation tests pass (3-6 tests)
  - **Acceptance Criteria:**
    - Configuration validation tests pass (3-6 tests)
    - Zod schema validates all required fields
    - Optional fields have sensible defaults
    - Invalid configurations throw clear errors
    - Configuration merging prioritizes user overrides
    - TypeScript autocomplete works for all options

- [ ] **1.6: Set Up Logger and Utilities**
  - **Effort:** 1 day
  - **Dependencies:** Task 1.5
  - **Description:**
    - Write 2-4 focused tests for logger and utilities
    - Create `src/utils/Logger.ts` using `@wdio/logger`
    - Configure scoped logger: `@wdio/flutter-service`
    - Create `src/utils/PlatformDetector.ts` for platform detection
    - Create `src/utils/ErrorMessages.ts` with helpful error templates
    - Implement debug mode support via environment variable
    - Add platform-specific utility functions
    - Ensure logger/utilities tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Logger/utilities tests pass (2-4 tests)
    - Logger integrates with @wdio/logger
    - Log levels work correctly (info, debug, warn, error)
    - Platform detection accurate on current OS
    - Error messages are helpful and actionable
    - Debug mode enables verbose logging

- [ ] **1.7: Integrate with Monorepo CI/CD**
  - **Effort:** 1 day
  - **Dependencies:** Task 1.6
  - **Description:**
    - Run ONLY tests written in tasks 1.3-1.6 (approximately 13-27 tests)
    - Add package to Turborepo pipeline
    - Verify package builds in CI
    - Verify tests run in CI
    - Verify linting passes in CI
    - Configure coverage reporting to CI
    - Test multi-platform CI matrix (ubuntu, windows, macos)
  - **Acceptance Criteria:**
    - Foundation tests pass in CI (approximately 13-27 tests)
    - Package builds successfully on all platforms
    - Linting passes on all platforms
    - Coverage reports uploaded
    - CI passes on ubuntu-latest, windows-latest, macos-latest
    - No blocking CI issues

**Task Group 1 Acceptance Criteria:**
- Package structure complete and follows conventions
- All foundation tests pass (approximately 13-27 tests total)
- Service and launcher base classes implemented
- Configuration schema defined and validated
- Logger and utilities set up
- CI/CD integration working
- Ready for Appium integration

---

### Task Group 2: Appium Integration and Management (1-2 weeks)

**Assigned Implementer:** integration-engineer
**Estimated Effort:** 5-10 days
**Dependencies:** Task Group 1
**Phase:** Foundation

#### Tasks

- [ ] **2.1: Implement Appium Server Detection**
  - **Effort:** 1 day
  - **Dependencies:** Task 1.7
  - **Description:**
    - Write 2-5 focused tests for server detection
    - Create `src/appium/ServerDetector.ts`
    - Implement port checking to detect running Appium server
    - Support custom host/port configuration
    - Test connection to existing Appium server
    - Handle connection timeouts gracefully
    - Ensure server detection tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Server detection tests pass (2-5 tests)
    - Detects Appium on localhost:4723 (default)
    - Supports custom host/port
    - Connection timeout handled
    - Returns boolean: server running or not

- [ ] **2.2: Implement Appium Server Management**
  - **Effort:** 2-3 days
  - **Dependencies:** Task 2.1
  - **Description:**
    - Write 3-6 focused tests for server lifecycle management
    - Create `src/appium/AppiumManager.ts`
    - Implement Appium server start logic (if not running)
    - Configure Appium server with proper options (host, port, log level)
    - Implement graceful server shutdown
    - Capture and log Appium server output
    - Handle Appium startup failures with retry logic
    - Reuse existing Appium server when available
    - Ensure server management tests pass (3-6 tests)
  - **Acceptance Criteria:**
    - Server management tests pass (3-6 tests)
    - Starts Appium server when not running
    - Reuses existing Appium server
    - Configures server with user options
    - Logs server output for debugging
    - Shuts down server cleanly
    - Handles startup failures gracefully

- [ ] **2.3: Implement Appium Flutter Driver Validation**
  - **Effort:** 1 day
  - **Dependencies:** Task 2.2
  - **Description:**
    - Write 2-4 focused tests for driver validation
    - Create `src/appium/DriverValidator.ts`
    - Check if `appium-flutter-driver` is installed
    - Validate driver version compatibility
    - Provide installation instructions if missing
    - Support skip validation flag for CI environments
    - Ensure driver validation tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Driver validation tests pass (2-4 tests)
    - Detects appium-flutter-driver installation
    - Validates driver version compatibility
    - Helpful error with install command if missing
    - Skip validation flag works
    - Validation runs before Appium server starts

- [ ] **2.4: Integrate Appium Manager with Launcher**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 2.3
  - **Description:**
    - Write 2-5 focused tests for launcher integration
    - Update `src/launcher.ts` `onPrepare` hook
    - Initialize AppiumManager with configuration
    - Validate Appium Flutter Driver installation
    - Start Appium server (if needed)
    - Store Appium connection info for service
    - Update `onComplete` hook to stop Appium server
    - Handle errors during Appium setup
    - Ensure launcher integration tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Launcher integration tests pass (2-5 tests)
    - AppiumManager initialized in onPrepare
    - Driver validation runs before server start
    - Appium server starts successfully
    - Connection info passed to WebdriverIO
    - Server stops in onComplete
    - Errors logged with helpful messages

- [ ] **2.5: Run Appium Integration Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 2.4
  - **Description:**
    - Run ONLY tests written in tasks 2.1-2.4 (approximately 9-20 tests)
    - Verify Appium server lifecycle works end-to-end
    - Test with real Appium server (integration test)
    - Verify error handling with missing driver
    - Verify configuration options work correctly
    - Document any platform-specific quirks
  - **Acceptance Criteria:**
    - Appium integration tests pass (approximately 9-20 tests)
    - Appium starts and stops correctly
    - Driver validation works as expected
    - Configuration options applied correctly
    - Integration test with real Appium passes
    - Platform-specific issues documented

**Task Group 2 Acceptance Criteria:**
- All Appium integration tests pass (approximately 9-20 tests total)
- Appium server management working
- Driver validation implemented
- Launcher integrates with Appium
- Server lifecycle reliable
- Ready for capability configuration

---

### Task Group 3: Binary Detection - Multi-Platform (2-3 weeks)

**Assigned Implementer:** platform-engineer
**Estimated Effort:** 10-15 days
**Dependencies:** Task Group 2
**Phase:** Binary Detection

#### Tasks

- [ ] **3.1: Create Flutter Binary Detector Base**
  - **Effort:** 1 day
  - **Dependencies:** Task 2.5
  - **Description:**
    - Write 2-4 focused tests for base detector
    - Create `src/binary-detection/FlutterBinaryDetector.ts`
    - Extend `BinaryDetector` from `@wdio/native-utils`
    - Implement platform-specific path generation strategy
    - Handle manual `appPath` override
    - Implement path validation (exists, executable)
    - Ensure base detector tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Base detector tests pass (2-4 tests)
    - Extends BinaryDetector correctly
    - Manual appPath override works
    - Path validation logic implemented
    - Strategy pattern for platform-specific detection

- [ ] **3.2: Implement pubspec.yaml Parser**
  - **Effort:** 2 days
  - **Dependencies:** Task 3.1
  - **Description:**
    - Write 3-5 focused tests for pubspec parser
    - Create `src/binary-detection/PubspecParser.ts`
    - Parse pubspec.yaml for app metadata
    - Extract app name, version, bundle identifier
    - Handle missing or invalid pubspec.yaml
    - Support custom project root paths
    - Cache parsed results for performance
    - Ensure pubspec parser tests pass (3-5 tests)
  - **Acceptance Criteria:**
    - Pubspec parser tests pass (3-5 tests)
    - Parses pubspec.yaml correctly
    - Extracts app name, version, bundle ID
    - Handles missing pubspec with helpful error
    - Handles invalid YAML gracefully
    - Results cached for repeated calls

- [ ] **3.3: Implement Android Binary Detection**
  - **Effort:** 2 days
  - **Dependencies:** Task 3.2
  - **Description:**
    - Write 3-6 focused tests for Android detection
    - Create `src/binary-detection/AndroidBinaryDetector.ts`
    - Generate paths: `build/app/outputs/flutter-apk/app-{mode}.apk`
    - Support debug, release, profile build modes
    - Support flavor-specific builds
    - Handle alternative APK locations
    - Validate APK is not corrupted
    - Provide helpful error with `flutter build apk` command
    - Ensure Android detection tests pass (3-6 tests)
  - **Acceptance Criteria:**
    - Android detection tests pass (3-6 tests)
    - Detects standard Flutter APK paths
    - Supports debug/release/profile modes
    - Supports flavor builds
    - Validates APK integrity
    - Helpful error message with build command

- [ ] **3.4: Implement iOS Binary Detection**
  - **Effort:** 2 days
  - **Dependencies:** Task 3.2
  - **Description:**
    - Write 3-6 focused tests for iOS detection
    - Create `src/binary-detection/IosBinaryDetector.ts`
    - Generate paths for simulator: `build/ios/iphonesimulator/Runner.app`
    - Generate paths for device: `build/ios/iphoneos/Runner.app`
    - Support Debug/Release/Profile modes
    - Handle Xcode build products structure
    - Detect target (simulator vs device) from config
    - Validate .app bundle structure
    - Provide helpful error with `flutter build ios` command
    - Ensure iOS detection tests pass (3-6 tests)
  - **Acceptance Criteria:**
    - iOS detection tests pass (3-6 tests)
    - Detects simulator app bundles
    - Detects device app bundles
    - Supports all build modes
    - Validates .app bundle integrity
    - Helpful error message with build command

- [ ] **3.5: Implement macOS Binary Detection**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 3.2
  - **Description:**
    - Write 2-5 focused tests for macOS detection
    - Create `src/binary-detection/MacOsBinaryDetector.ts`
    - Parse pubspec.yaml for app name
    - Generate path: `build/macos/Build/Products/{Mode}/{AppName}.app`
    - Support Debug/Release/Profile modes
    - Handle Intel and Apple Silicon builds
    - Validate .app bundle structure
    - Provide helpful error with `flutter build macos` command
    - Ensure macOS detection tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - macOS detection tests pass (2-5 tests)
    - Detects macOS app bundles
    - Uses app name from pubspec.yaml
    - Supports all build modes
    - Validates .app bundle integrity
    - Helpful error message with build command

- [ ] **3.6: Implement Windows Binary Detection**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 3.2
  - **Description:**
    - Write 2-5 focused tests for Windows detection
    - Create `src/binary-detection/WindowsBinaryDetector.ts`
    - Parse pubspec.yaml for executable name
    - Generate path: `build/windows/x64/runner/{mode}/{appname}.exe`
    - Support x64 and arm64 architectures
    - Support debug/release build modes
    - Validate .exe is executable
    - Provide helpful error with `flutter build windows` command
    - Ensure Windows detection tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Windows detection tests pass (2-5 tests)
    - Detects Windows executables
    - Uses executable name from pubspec.yaml
    - Supports x64 and arm64
    - Validates .exe integrity
    - Helpful error message with build command

- [ ] **3.7: Implement Linux Binary Detection**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 3.2
  - **Description:**
    - Write 2-5 focused tests for Linux detection
    - Create `src/binary-detection/LinuxBinaryDetector.ts`
    - Parse pubspec.yaml for executable name
    - Generate path: `build/linux/x64/{mode}/bundle/{appname}`
    - Support x64 and arm64 architectures
    - Support debug/release build modes
    - Validate executable permissions
    - Provide helpful error with `flutter build linux` command
    - Ensure Linux detection tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Linux detection tests pass (2-5 tests)
    - Detects Linux executables
    - Uses executable name from pubspec.yaml
    - Supports x64 and arm64
    - Validates executable permissions
    - Helpful error message with build command

- [ ] **3.8: Integrate Binary Detection with Launcher**
  - **Effort:** 1 day
  - **Dependencies:** Tasks 3.3-3.7
  - **Description:**
    - Write 2-4 focused tests for launcher integration
    - Update `src/launcher.ts` to use FlutterBinaryDetector
    - Detect platform from configuration
    - Run binary detection in `onPrepare` hook
    - Store detected path for capability configuration
    - Handle detection failures with helpful errors
    - Support manual override via config.appPath
    - Ensure launcher integration tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Launcher integration tests pass (2-4 tests)
    - Binary detection runs in onPrepare
    - Detected path stored correctly
    - Platform detection works
    - Manual override supported
    - Detection failures handled gracefully

- [ ] **3.9: Run Binary Detection Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 3.8
  - **Description:**
    - Run ONLY tests written in tasks 3.1-3.8 (approximately 20-40 tests)
    - Verify detection works for all 5 platforms
    - Test with mock Flutter project structures
    - Test error handling for missing binaries
    - Test manual override paths
    - Document platform-specific path patterns
  - **Acceptance Criteria:**
    - Binary detection tests pass (approximately 20-40 tests)
    - All 5 platforms detect binaries correctly
    - Error messages are helpful
    - Manual override works
    - Mock Flutter projects in test fixtures
    - Platform-specific patterns documented

**Task Group 3 Acceptance Criteria:**
- All binary detection tests pass (approximately 20-40 tests total)
- Binary detection works for all 5 platforms
- pubspec.yaml parsing implemented
- Platform-specific paths validated
- Error messages helpful and actionable
- Ready for capability configuration

---

### Task Group 4: Capability Configuration - Multi-Platform (1-2 weeks)

**Assigned Implementer:** configuration-engineer
**Estimated Effort:** 5-10 days
**Dependencies:** Task Group 3
**Phase:** Multi-Platform Support

#### Tasks

- [ ] **4.1: Create Capability Builder Base**
  - **Effort:** 1 day
  - **Dependencies:** Task 3.9
  - **Description:**
    - Write 2-4 focused tests for capability builder
    - Create `src/capabilities/CapabilityBuilder.ts`
    - Implement base capability generation (common to all platforms)
    - Implement platform detection and routing
    - Implement configuration merging logic
    - Support custom capabilities override
    - Ensure capability builder tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Capability builder tests pass (2-4 tests)
    - Base capabilities include automationName: 'Flutter'
    - Platform routing works correctly
    - Configuration merging prioritizes user overrides
    - Custom capabilities merged properly

- [ ] **4.2: Implement Android Capabilities**
  - **Effort:** 1 day
  - **Dependencies:** Task 4.1
  - **Description:**
    - Write 2-5 focused tests for Android capabilities
    - Create `src/capabilities/AndroidCapabilities.ts`
    - Set platformName: 'Android'
    - Configure device name (emulator or device UDID)
    - Configure platform version (API level)
    - Configure app path from binary detection
    - Configure Flutter Driver port (default 8181)
    - Set appium:retries: 0
    - Ensure Android capabilities tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Android capabilities tests pass (2-5 tests)
    - Capabilities object formatted correctly
    - Device name/UDID configured
    - Platform version configured
    - App path from detection used
    - Flutter Driver port configured

- [ ] **4.3: Implement iOS Capabilities**
  - **Effort:** 1 day
  - **Dependencies:** Task 4.1
  - **Description:**
    - Write 2-5 focused tests for iOS capabilities
    - Create `src/capabilities/IosCapabilities.ts`
    - Set platformName: 'iOS'
    - Configure device name (simulator or device UDID)
    - Configure platform version (iOS version, default 15.0)
    - Configure app path from binary detection
    - Configure Flutter Driver port (default 8181)
    - Handle simulator vs device target
    - Ensure iOS capabilities tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - iOS capabilities tests pass (2-5 tests)
    - Capabilities object formatted correctly
    - Device name/UDID configured
    - Platform version configured (default 15.0)
    - App path from detection used
    - Simulator vs device handled

- [ ] **4.4: Implement Desktop Capabilities**
  - **Effort:** 1 day
  - **Dependencies:** Task 4.1
  - **Description:**
    - Write 2-5 focused tests for desktop capabilities
    - Create `src/capabilities/DesktopCapabilities.ts`
    - Set platformName: 'Desktop'
    - Configure app path from binary detection
    - Configure Flutter Driver port (default 8181)
    - Support Windows, macOS, Linux
    - Handle architecture differences (x64, arm64, Intel, Apple Silicon)
    - Ensure desktop capabilities tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Desktop capabilities tests pass (2-5 tests)
    - Capabilities object formatted correctly
    - App path from detection used
    - Supports Windows, macOS, Linux
    - Architecture handled transparently

- [ ] **4.5: Integrate Capability Builder with Launcher**
  - **Effort:** 1 day
  - **Dependencies:** Tasks 4.2-4.4
  - **Description:**
    - Write 2-4 focused tests for launcher integration
    - Update `src/launcher.ts` to use CapabilityBuilder
    - Generate capabilities in `onPrepare` hook
    - Use detected app path from binary detection
    - Merge with user-provided capabilities
    - Apply capabilities to WebdriverIO session
    - Log capabilities for debugging
    - Ensure launcher integration tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Launcher integration tests pass (2-4 tests)
    - Capabilities generated in onPrepare
    - App path from detection used
    - User capabilities merged correctly
    - Capabilities applied to session
    - Capabilities logged for debugging

- [ ] **4.6: Test Multi-Platform Capability Configuration**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 4.5
  - **Description:**
    - Run ONLY tests written in tasks 4.1-4.5 (approximately 10-23 tests)
    - Verify capabilities for all 5 platforms
    - Test capability merging logic
    - Test custom capability overrides
    - Test device selection (emulator, simulator, real device)
    - Test multiremote configuration patterns
    - Document capability examples for each platform
  - **Acceptance Criteria:**
    - Capability configuration tests pass (approximately 10-23 tests)
    - All 5 platforms generate correct capabilities
    - Capability merging works as expected
    - Custom overrides respected
    - Device selection works
    - Multiremote patterns documented

**Task Group 4 Acceptance Criteria:**
- All capability configuration tests pass (approximately 10-23 tests total)
- Capabilities generated for all 5 platforms
- Device selection supported
- Custom capabilities merged correctly
- Launcher integration complete
- Ready for command implementation

---

### Task Group 5: Core Flutter Commands (3-4 weeks)

**Assigned Implementer:** command-engineer
**Estimated Effort:** 15-20 days
**Dependencies:** Task Group 4
**Phase:** Core Commands

#### Tasks

- [ ] **5.1: Implement Element Finding Commands**
  - **Effort:** 2-3 days
  - **Dependencies:** Task 4.6
  - **Description:**
    - Write 3-7 focused tests for element finders
    - Create `src/commands/finder.ts`
    - Integrate `appium-flutter-finder` package
    - Implement `byValueKey(key)` command
    - Implement `byType(type)` command
    - Implement `byText(text)` command
    - Implement `bySemanticsLabel(label)` command
    - Implement `byTooltip(tooltip)` command
    - Return element for chaining
    - Ensure element finder tests pass (3-7 tests)
  - **Acceptance Criteria:**
    - Element finder tests pass (3-7 tests)
    - All 5 finder commands implemented
    - Commands use appium-flutter-finder
    - Commands return element correctly
    - TypeScript types defined for all commands

- [ ] **5.2: Implement Interaction Commands (Part 1)**
  - **Effort:** 2-3 days
  - **Dependencies:** Task 5.1
  - **Description:**
    - Write 3-5 focused tests for tap, enterText, longPress
    - Create `src/commands/interaction.ts`
    - Implement `tap(finder)` command
    - Implement `enterText(finder, text)` command
    - Implement `longPress(finder, duration)` command
    - Add implicit waits for elements
    - Handle timeout errors gracefully
    - Ensure interaction tests pass (3-5 tests)
  - **Acceptance Criteria:**
    - Interaction tests pass (3-5 tests)
    - tap() command works
    - enterText() command works
    - longPress() command works with duration
    - Implicit waits implemented
    - Timeout errors handled

- [ ] **5.3: Implement Interaction Commands (Part 2)**
  - **Effort:** 2-3 days
  - **Dependencies:** Task 5.2
  - **Description:**
    - Write 3-5 focused tests for scroll, scrollUntilVisible, drag
    - Continue `src/commands/interaction.ts`
    - Implement `scroll(finder, options)` command
    - Implement `scrollUntilVisible(itemFinder, scrollableFinder)` command
    - Implement `drag(finder, offset)` command
    - Support scroll direction and distance options
    - Handle scroll errors gracefully
    - Ensure scroll/drag tests pass (3-5 tests)
  - **Acceptance Criteria:**
    - Scroll/drag tests pass (3-5 tests)
    - scroll() command with direction/distance
    - scrollUntilVisible() finds hidden items
    - drag() command with dx/dy offset
    - Scroll options validated
    - Errors handled gracefully

- [ ] **5.4: Implement Waiting Commands**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 5.1
  - **Description:**
    - Write 2-4 focused tests for waiting commands
    - Create `src/commands/waiting.ts`
    - Implement `waitForWidget(finder, timeout)` command
    - Implement `waitForAbsent(finder, timeout)` command
    - Implement `waitUntilNoTransientCallbacks(timeout)` command
    - Support custom timeout values
    - Default timeout: 5000ms
    - Ensure waiting tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Waiting tests pass (2-4 tests)
    - waitForWidget() waits for presence
    - waitForAbsent() waits for absence
    - waitUntilNoTransientCallbacks() waits for animations
    - Custom timeouts work
    - Timeout errors informative

- [ ] **5.5: Implement Assertion Commands**
  - **Effort:** 1-2 days
  - **Dependencies:** Task 5.1
  - **Description:**
    - Write 2-5 focused tests for assertion commands
    - Create `src/commands/assertion.ts`
    - Implement `getText(finder)` command
    - Implement `isPresent(finder)` command
    - Implement `isVisible(finder)` command
    - Implement `getWidgetTree()` debug command
    - Return appropriate types (string, boolean)
    - Ensure assertion tests pass (2-5 tests)
  - **Acceptance Criteria:**
    - Assertion tests pass (2-5 tests)
    - getText() returns widget text
    - isPresent() returns boolean
    - isVisible() returns boolean
    - getWidgetTree() returns hierarchy string
    - TypeScript types correct for return values

- [ ] **5.6: Register Commands on browser.flutter Namespace**
  - **Effort:** 1 day
  - **Dependencies:** Tasks 5.1-5.5
  - **Description:**
    - Write 2-4 focused tests for command registration
    - Create `src/commands/index.ts` to export all commands
    - Update `src/service.ts` `before` hook
    - Register all commands on `browser.flutter` namespace
    - Use WebdriverIO `addCommand` API
    - Avoid conflicts with existing browser commands
    - Add TypeScript declarations for browser.flutter
    - Ensure command registration tests pass (2-4 tests)
  - **Acceptance Criteria:**
    - Command registration tests pass (2-4 tests)
    - All commands registered on browser.flutter
    - Commands accessible: `browser.flutter.tap('key')`
    - No conflicts with existing commands
    - TypeScript autocomplete works
    - Commands available in test files

- [ ] **5.7: Test Commands with Mock Driver**
  - **Effort:** 2 days
  - **Dependencies:** Task 5.6
  - **Description:**
    - Run ONLY tests written in tasks 5.1-5.6 (approximately 15-30 tests)
    - Create comprehensive mock Appium driver
    - Test all element finding commands
    - Test all interaction commands
    - Test all waiting commands
    - Test all assertion commands
    - Verify command chaining works
    - Verify error handling in commands
  - **Acceptance Criteria:**
    - Command tests pass (approximately 15-30 tests)
    - Mock driver behaves realistically
    - All commands tested individually
    - Command chaining tested
    - Error handling verified
    - Commands work with mock driver

**Task Group 5 Acceptance Criteria:**
- All command tests pass (approximately 15-30 tests total)
- All element finding commands implemented
- All interaction commands implemented
- All waiting commands implemented
- All assertion commands implemented
- Commands registered on browser.flutter namespace
- Ready for integration testing

---

### Task Group 6: Integration Testing with Appium (1 week)

**Assigned Implementer:** testing-engineer
**Estimated Effort:** 5 days
**Dependencies:** Task Group 5
**Phase:** Multi-Platform Support

#### Tasks

- [ ] **6.1: Review Existing Tests and Identify Gaps**
  - **Effort:** 1 day
  - **Dependencies:** Task 5.7
  - **Description:**
    - Review tests written in Task Groups 1-5
    - Identify critical integration test gaps
    - Focus on service lifecycle integration
    - Focus on Appium connection workflows
    - Focus on command execution against real driver
    - Prioritize end-to-end workflows over unit test gaps
  - **Acceptance Criteria:**
    - All existing tests reviewed
    - Critical gaps identified and documented
    - Integration test plan created
    - Priorities established

- [ ] **6.2: Write Appium Connection Integration Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 6.1
  - **Description:**
    - Write maximum 3-5 integration tests for Appium connection
    - Test launcher starts Appium successfully
    - Test service registers commands
    - Test capabilities applied to session
    - Test binary detection → capability generation flow
    - Test cleanup on test completion
  - **Acceptance Criteria:**
    - Appium connection tests pass (3-5 tests)
    - Full service lifecycle tested
    - Appium server starts and stops
    - Commands registered successfully
    - Capabilities applied correctly

- [ ] **6.3: Write Command Execution Integration Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 6.2
  - **Description:**
    - Write maximum 3-5 integration tests for command execution
    - Test element finding with real Appium driver
    - Test interaction commands execute correctly
    - Test waiting commands with timeouts
    - Test assertion commands return correct values
    - Test error handling with invalid finders
  - **Acceptance Criteria:**
    - Command execution tests pass (3-5 tests)
    - Commands execute against real driver
    - Element finding works
    - Interactions execute
    - Waiting commands work
    - Error handling verified

- [ ] **6.4: Write Multi-Platform Configuration Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 6.3
  - **Description:**
    - Write maximum 3-5 integration tests for platform configuration
    - Test Android configuration end-to-end
    - Test iOS configuration end-to-end
    - Test desktop configuration end-to-end
    - Test configuration merging with overrides
    - Test device selection logic
  - **Acceptance Criteria:**
    - Platform configuration tests pass (3-5 tests)
    - Android config works end-to-end
    - iOS config works end-to-end
    - Desktop config works end-to-end
    - Configuration merging verified
    - Device selection works

- [ ] **6.5: Run All Integration Tests**
  - **Effort:** 1 day
  - **Dependencies:** Task 6.4
  - **Description:**
    - Run ONLY the 9-15 integration tests written in tasks 6.2-6.4
    - Verify all integration tests pass
    - Test on primary development platform
    - Document any platform-specific issues
    - Ensure integration tests are stable and repeatable
  - **Acceptance Criteria:**
    - Integration tests pass (9-15 tests total)
    - Tests are stable and repeatable
    - Platform-specific issues documented
    - Integration test suite ready for CI

**Task Group 6 Acceptance Criteria:**
- Integration tests pass (9-15 tests total)
- Appium connection tested end-to-end
- Command execution verified with real driver
- Multi-platform configuration tested
- Critical workflows covered
- Ready for example applications

---

### Task Group 7: Example Applications - All Platforms (2-3 weeks)

**Assigned Implementer:** example-engineer
**Estimated Effort:** 10-15 days
**Dependencies:** Task Group 6
**Phase:** Examples and Documentation

#### Tasks

- [ ] **7.1: Create Example Flutter App Structure**
  - **Effort:** 1 day
  - **Dependencies:** Task 6.5
  - **Description:**
    - Create `examples/flutter/` directory structure
    - Set up mobile examples: `examples/flutter/mobile/{android,ios}/`
    - Set up desktop examples: `examples/flutter/desktop/{windows,macos,linux}/`
    - Create shared Flutter app code in `lib/main.dart`
    - Design simple app with key features for testing
  - **Key App Features:**
    - Login screen with username/password fields
    - Home screen with navigation tabs
    - List screen with 100+ scrollable items
    - Settings screen with toggles
    - Navigation between screens
  - **Acceptance Criteria:**
    - Example directory structure created
    - Shared Flutter app code written
    - App has login, home, list, settings screens
    - All widgets have ValueKey for testing
    - App builds on at least one platform

- [ ] **7.2: Create Android Example App and Tests**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.1
  - **Description:**
    - Set up Android project in `examples/flutter/mobile/android/`
    - Create `pubspec.yaml` with dependencies
    - Build Android APK: `flutter build apk`
    - Create `wdio.conf.js` for Android
    - Write 3-5 example tests covering key workflows
    - Test login flow, navigation, list scrolling
  - **Acceptance Criteria:**
    - Android app builds successfully
    - wdio.conf.js configured for Android
    - 3-5 example tests written
    - Tests pass against Android emulator
    - Tests demonstrate key service features

- [ ] **7.3: Create iOS Example App and Tests**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.1
  - **Description:**
    - Set up iOS project in `examples/flutter/mobile/ios/`
    - Create `pubspec.yaml` with dependencies
    - Build iOS app: `flutter build ios`
    - Create `wdio.conf.js` for iOS
    - Write 3-5 example tests covering key workflows
    - Test login flow, navigation, list scrolling
  - **Acceptance Criteria:**
    - iOS app builds successfully
    - wdio.conf.js configured for iOS
    - 3-5 example tests written
    - Tests pass against iOS simulator
    - Tests demonstrate key service features

- [ ] **7.4: Create Windows Example App and Tests**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.1
  - **Description:**
    - Set up Windows project in `examples/flutter/desktop/windows/`
    - Create `pubspec.yaml` with dependencies
    - Build Windows app: `flutter build windows`
    - Create `wdio.conf.js` for Windows
    - Write 3-5 example tests covering key workflows
    - Test login flow, navigation, list scrolling
  - **Acceptance Criteria:**
    - Windows app builds successfully
    - wdio.conf.js configured for Windows
    - 3-5 example tests written
    - Tests pass on Windows OS
    - Tests demonstrate key service features

- [ ] **7.5: Create macOS Example App and Tests**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.1
  - **Description:**
    - Set up macOS project in `examples/flutter/desktop/macos/`
    - Create `pubspec.yaml` with dependencies
    - Build macOS app: `flutter build macos`
    - Create `wdio.conf.js` for macOS
    - Write 3-5 example tests covering key workflows
    - Test login flow, navigation, list scrolling
  - **Acceptance Criteria:**
    - macOS app builds successfully
    - wdio.conf.js configured for macOS
    - 3-5 example tests written
    - Tests pass on macOS OS
    - Tests demonstrate key service features

- [ ] **7.6: Create Linux Example App and Tests**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.1
  - **Description:**
    - Set up Linux project in `examples/flutter/desktop/linux/`
    - Create `pubspec.yaml` with dependencies
    - Build Linux app: `flutter build linux`
    - Create `wdio.conf.js` for Linux
    - Write 3-5 example tests covering key workflows
    - Test login flow, navigation, list scrolling
  - **Acceptance Criteria:**
    - Linux app builds successfully
    - wdio.conf.js configured for Linux
    - 3-5 example tests written
    - Tests pass on Linux OS
    - Tests demonstrate key service features

- [ ] **7.7: Validate All Example Tests in CI**
  - **Effort:** 1-2 days
  - **Dependencies:** Tasks 7.2-7.6
  - **Description:**
    - Configure CI matrix for all 5 platforms
    - Android: ubuntu-latest with Android emulator
    - iOS: macos-latest with iOS simulator
    - Windows: windows-latest
    - macOS: macos-latest
    - Linux: ubuntu-latest
    - Run example tests in CI
    - Fix any CI-specific issues
    - Document CI setup for each platform
  - **Acceptance Criteria:**
    - CI matrix configured for all platforms
    - All example tests pass in CI
    - Android tests run on ubuntu with emulator
    - iOS tests run on macos with simulator
    - Desktop tests run on respective OS
    - CI documentation complete

**Task Group 7 Acceptance Criteria:**
- Example apps created for all 5 platforms
- 15-25 example tests written total (3-5 per platform)
- All example tests pass locally
- All example tests pass in CI
- Examples demonstrate all key service features
- Ready for documentation

---

### Task Group 8: Documentation and Migration Guides (1-2 weeks)

**Assigned Implementer:** documentation-engineer
**Estimated Effort:** 5-10 days
**Dependencies:** Task Group 7
**Phase:** Examples and Documentation

#### Tasks

- [ ] **8.1: Write Comprehensive README**
  - **Effort:** 2 days
  - **Dependencies:** Task 7.7
  - **Description:**
    - Create `packages/@wdio/flutter-service/README.md`
    - Write quick start guide
    - Document installation instructions
    - Provide configuration examples for all platforms
    - Document all commands with examples
    - Add troubleshooting section
    - Include links to examples
  - **Sections to Include:**
    - Overview and features
    - Installation
    - Quick start (Android example)
    - Configuration reference
    - Command API reference
    - Platform-specific setup guides
    - Troubleshooting
    - Examples
  - **Acceptance Criteria:**
    - README is comprehensive
    - Quick start guide works
    - All commands documented
    - Configuration examples for all platforms
    - Troubleshooting section helpful
    - Links to examples work

- [ ] **8.2: Write Platform Setup Guides**
  - **Effort:** 2 days
  - **Dependencies:** Task 8.1
  - **Description:**
    - Create platform-specific setup documentation
    - Document Android SDK requirements and setup
    - Document iOS/Xcode requirements and setup
    - Document Windows Flutter requirements and setup
    - Document macOS Flutter requirements and setup
    - Document Linux Flutter requirements and setup
    - Document Appium and driver installation
  - **Acceptance Criteria:**
    - All 5 platforms have setup guides
    - Android SDK setup documented
    - iOS/Xcode setup documented
    - Desktop platform requirements documented
    - Appium installation documented
    - Driver installation documented

- [ ] **8.3: Write API Documentation**
  - **Effort:** 1 day
  - **Dependencies:** Task 8.1
  - **Description:**
    - Add JSDoc comments to all public APIs
    - Document all configuration options
    - Document all command parameters
    - Document return types
    - Add code examples to JSDoc
    - Ensure TypeScript types serve as documentation
  - **Acceptance Criteria:**
    - All public APIs have JSDoc comments
    - All configuration options documented
    - All commands have parameter docs
    - Return types documented
    - Code examples in JSDoc
    - TypeScript autocomplete informative

- [ ] **8.4: Write Migration Guide from Pure Appium**
  - **Effort:** 1 day
  - **Dependencies:** Task 8.2
  - **Description:**
    - Create migration guide document
    - Show before/after code examples
    - Document benefits of migration
    - Provide step-by-step migration process
    - Document breaking changes (if any)
    - Address common migration questions
  - **Sections to Include:**
    - Why migrate from pure Appium
    - Before/after comparison
    - Step-by-step migration
    - Configuration changes
    - Test code changes
    - Common issues and solutions
  - **Acceptance Criteria:**
    - Migration guide complete
    - Before/after examples clear
    - Step-by-step process works
    - Common questions addressed
    - Migration path clear and easy

- [ ] **8.5: Write Troubleshooting Guide**
  - **Effort:** 1 day
  - **Dependencies:** Task 8.3
  - **Description:**
    - Create troubleshooting guide document
    - Document common errors and solutions
    - Binary detection failures
    - Appium connection issues
    - Driver installation problems
    - Platform-specific issues
    - Device/emulator configuration issues
  - **Common Issues to Cover:**
    - "Binary not found" - how to build Flutter app
    - "Appium driver not installed" - installation steps
    - "Cannot connect to device" - device setup
    - "Command timeout" - increasing timeouts
    - Platform-specific quirks
  - **Acceptance Criteria:**
    - Troubleshooting guide complete
    - Common errors documented
    - Solutions actionable
    - Platform-specific issues covered
    - Error messages cross-referenced

- [ ] **8.6: Review and Polish All Documentation**
  - **Effort:** 1 day
  - **Dependencies:** Tasks 8.1-8.5
  - **Description:**
    - Review all documentation for completeness
    - Check all code examples work
    - Verify all links are valid
    - Fix typos and grammar issues
    - Ensure consistent formatting
    - Test instructions on fresh environment
  - **Acceptance Criteria:**
    - All documentation reviewed
    - All code examples tested
    - All links valid
    - No typos or grammar issues
    - Formatting consistent
    - Instructions work on fresh setup

**Task Group 8 Acceptance Criteria:**
- README comprehensive and clear
- Platform setup guides complete for all 5 platforms
- API documentation complete with JSDoc
- Migration guide from pure Appium written
- Troubleshooting guide helpful
- All documentation polished and tested

---

### Task Group 9: Final Validation and Release Preparation (1 week)

**Assigned Implementer:** testing-engineer
**Estimated Effort:** 5 days
**Dependencies:** Task Group 8
**Phase:** Stabilization

#### Tasks

- [ ] **9.1: Run Complete Test Suite**
  - **Effort:** 1 day
  - **Dependencies:** Task 8.6
  - **Description:**
    - Run ALL tests written across all task groups
    - Verify 80%+ code coverage achieved
    - Run tests on all 3 CI platforms (ubuntu, windows, macos)
    - Fix any failing tests
    - Document any known issues
    - Total expected tests: approximately 87-143 tests
  - **Test Breakdown:**
    - Task Group 1: ~13-27 foundation tests
    - Task Group 2: ~9-20 Appium integration tests
    - Task Group 3: ~20-40 binary detection tests
    - Task Group 4: ~10-23 capability configuration tests
    - Task Group 5: ~15-30 command tests
    - Task Group 6: ~9-15 integration tests
    - Task Group 7: ~15-25 example tests (E2E)
  - **Acceptance Criteria:**
    - All tests pass (approximately 87-143 tests)
    - 80%+ code coverage achieved
    - Tests pass on ubuntu, windows, macos
    - No flaky tests
    - Known issues documented

- [ ] **9.2: Validate Multi-Platform E2E Workflows**
  - **Effort:** 1 day
  - **Dependencies:** Task 9.1
  - **Description:**
    - Manually test on at least 3 platforms
    - Android: Test with emulator
    - iOS: Test with simulator
    - Desktop: Test on one desktop OS
    - Verify all example apps run correctly
    - Verify all example tests pass
    - Document any platform-specific quirks
  - **Acceptance Criteria:**
    - Android app tested with emulator
    - iOS app tested with simulator
    - One desktop platform tested
    - All example apps run
    - All example tests pass
    - Platform quirks documented

- [ ] **9.3: Performance and Bundle Size Check**
  - **Effort:** 0.5 days
  - **Dependencies:** Task 9.1
  - **Description:**
    - Measure package bundle size
    - Verify minimal overhead over pure Appium
    - Test Appium server startup time
    - Test binary detection performance
    - Optimize if necessary
    - Document performance characteristics
  - **Acceptance Criteria:**
    - Bundle size reasonable
    - Appium startup < 5 seconds
    - Binary detection < 1 second
    - No performance regressions
    - Performance documented

- [ ] **9.4: Validate TypeScript Types and Exports**
  - **Effort:** 0.5 days
  - **Dependencies:** Task 9.1
  - **Description:**
    - Verify TypeScript declaration files generated
    - Test imports in TypeScript project
    - Test imports in JavaScript project
    - Verify browser.flutter namespace typed
    - Verify autocomplete works in VSCode
    - Check for any type errors
  - **Acceptance Criteria:**
    - Declaration files generated correctly
    - TypeScript imports work
    - JavaScript imports work
    - browser.flutter typed correctly
    - Autocomplete works
    - No type errors

- [ ] **9.5: Code Quality and Standards Review**
  - **Effort:** 1 day
  - **Dependencies:** Task 9.4
  - **Description:**
    - Run Biome linting on entire package
    - Fix any linting errors
    - Review code for consistency
    - Check for circular dependencies
    - Verify error handling throughout
    - Ensure logging is appropriate
    - Review against monorepo standards
  - **Acceptance Criteria:**
    - Biome linting passes
    - No circular dependencies
    - Error handling comprehensive
    - Logging appropriate
    - Code follows monorepo standards
    - Code review ready

- [ ] **9.6: Prepare for Item #5 (Widget Testing Integration)**
  - **Effort:** 1 day
  - **Dependencies:** Task 9.5
  - **Description:**
    - Document extension points for advanced features
    - Identify areas for widget testing enhancements
    - Document architecture decisions
    - Create technical handoff notes
    - Verify no blocking bugs
    - Confirm success criteria met
  - **Acceptance Criteria:**
    - Extension points documented
    - Widget testing integration areas identified
    - Architecture documented
    - Handoff notes complete
    - No blocking bugs
    - Success criteria verified

**Task Group 9 Acceptance Criteria:**
- All tests pass (approximately 87-143 tests total)
- 80%+ code coverage achieved
- Multi-platform E2E workflows validated
- Performance characteristics acceptable
- TypeScript types correct
- Code quality standards met
- Ready for Item #5

---

## Testing Strategy Summary

### Test Distribution by Type

**Unit Tests:** ~67-118 tests
- Foundation: ~13-27 tests
- Appium Integration: ~9-20 tests
- Binary Detection: ~20-40 tests
- Capability Configuration: ~10-23 tests
- Commands: ~15-30 tests

**Integration Tests:** ~9-15 tests
- Appium connection workflows
- Command execution with real driver
- Multi-platform configuration

**E2E Tests (Examples):** ~15-25 tests
- 3-5 tests per platform × 5 platforms
- Real Flutter apps with real Appium

**Total Expected Tests:** ~87-143 tests

### Coverage Requirements

- **Minimum 80% code coverage** across all modules
- Focus on critical paths and user workflows
- Unit tests for utilities and core logic
- Integration tests for Appium workflows
- E2E tests validate real-world usage

### Testing Approach

- **Write minimal tests during development**: Each task group writes 2-8 focused tests
- **Test only core functionality**: Skip edge cases and exhaustive coverage during development
- **Run ONLY newly written tests**: Each task group runs its own tests, not entire suite
- **Integration testing phase**: Task Group 6 adds maximum 10 integration tests to fill gaps
- **Final validation**: Task Group 9 runs ALL tests together

---

## Dependencies Summary

### Upstream Dependencies (Required)

- **Item #1: Monorepo Foundation** ✅ MUST be complete
  - pnpm workspaces
  - Turborepo build orchestration
  - Shared TypeScript configurations
  - CI/CD pipeline infrastructure

- **Item #2: Electron Service Migration** ✅ Reference implementation
  - Service lifecycle patterns
  - Binary detection patterns
  - Configuration merging strategies
  - Command registration examples

- **Item #3: Shared Core Utilities** ✅ MUST be complete
  - BaseLauncher class
  - BaseService class
  - BinaryDetector abstract class
  - ConfigReader utilities
  - PlatformUtils
  - LoggerFactory
  - Testing utilities

### External Dependencies

**Required Tools:**
- Node.js 22 LTS
- pnpm 10.x
- Flutter SDK 3.0+
- Appium 2.x
- appium-flutter-driver

**Platform-Specific Tools:**
- Android: Android SDK, Android Emulator, adb
- iOS: Xcode, iOS Simulator (macOS only)
- Windows: Visual Studio 2019+ (C++ tools)
- macOS: Xcode Command Line Tools
- Linux: CMake, ninja-build, clang

### Downstream Dependencies

- **Item #5: Flutter Service Widget Testing Integration**
  - Will build on this foundation
  - Add advanced widget testing features
  - Screenshot comparison
  - Visual regression testing

- **Item #10: Cross-Service Testing**
  - Will validate Flutter service
  - Compare patterns across services

---

## Execution Order

Recommended implementation sequence:

1. **Task Group 1** (Foundation) - 2-3 weeks
2. **Task Group 2** (Appium Integration) - 1-2 weeks
3. **Task Group 3** (Binary Detection) - 2-3 weeks
4. **Task Group 4** (Capability Configuration) - 1-2 weeks
5. **Task Group 5** (Core Commands) - 3-4 weeks
6. **Task Group 6** (Integration Testing) - 1 week
7. **Task Group 7** (Example Applications) - 2-3 weeks
8. **Task Group 8** (Documentation) - 1-2 weeks
9. **Task Group 9** (Final Validation) - 1 week

**Total: 10-14 weeks (50-70 working days)**

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Appium Flutter Driver API changes | High | Medium | Pin driver version, test multiple versions, monitor releases |
| Platform-specific Appium issues | Medium | Medium | Comprehensive platform testing in CI, fallback strategies |
| Flutter build output changes | Low | Low | Test against Flutter 3.0, 3.3, 3.7+, document supported versions |
| Mobile device configuration complexity | Medium | High | Excellent documentation, clear examples, helpful error messages |
| Desktop platform differences | Medium | Medium | Platform-specific configuration helpers, abstraction layer |
| Binary detection failures | Medium | Medium | Multiple path patterns, clear error messages with build commands |
| CI capacity for mobile testing | Medium | Medium | Use GitHub Actions with Android emulator, iOS simulator |

---

## Success Criteria

The Flutter service is complete when:

1. ✅ **Package created:**
   - `@wdio/flutter-service` in packages directory
   - 80%+ test coverage (~87-143 tests)
   - All linting and type checks pass
   - Documentation complete

2. ✅ **Appium integration functional:**
   - Appium server management working
   - Driver validation implemented
   - Capability configuration automatic
   - Flutter Driver connection reliable

3. ✅ **Binary detection working:**
   - Auto-detects Flutter apps on all 5 platforms
   - Handles debug, release, profile builds
   - Parses pubspec.yaml correctly
   - Clear error messages with build commands

4. ✅ **Commands implemented:**
   - All element finding commands (byValueKey, byType, etc.)
   - All interaction commands (tap, scroll, drag, etc.)
   - All waiting commands (waitForWidget, waitForAbsent, etc.)
   - All assertion commands (getText, isPresent, etc.)
   - Registered on browser.flutter namespace

5. ✅ **Multi-platform support:**
   - iOS (simulator + device) validated
   - Android (emulator + device) validated
   - Windows (x64 + arm64) validated
   - macOS (Intel + Apple Silicon) validated
   - Linux (x64 + arm64) validated

6. ✅ **Examples complete:**
   - Example app for each of 5 platforms
   - 15-25 example tests (3-5 per platform)
   - All example tests pass locally and in CI
   - Examples demonstrate all key features

7. ✅ **Quality standards:**
   - TypeScript strict mode
   - Dual ESM/CJS builds
   - Declaration files included
   - Vitest tests with coverage
   - Biome linting passes
   - No circular dependencies

8. ✅ **Documentation complete:**
   - README with quick start
   - Platform setup guides (all 5 platforms)
   - API documentation (JSDoc)
   - Migration guide from pure Appium
   - Troubleshooting guide

9. ✅ **Ready for Item #5:**
   - Foundation stable
   - Extension points documented
   - Performance benchmarks established
   - No blocking bugs

---

## Notes

- **Implementer Roles**: The standard implementer roles (database-engineer, api-engineer, ui-designer, testing-engineer) don't perfectly align with this infrastructure package project. The roles assigned above (infrastructure-engineer, integration-engineer, platform-engineer, etc.) are adapted for this specific project type.

- **Multi-Platform Complexity**: This is significantly more complex than a typical service due to supporting 5 platforms with different binary formats, build outputs, and runtime environments.

- **Testing Strategy**: Focus on strategic testing with ~87-143 total tests rather than exhaustive coverage. Each task group writes 2-8 focused tests during development, with a dedicated integration testing phase to fill gaps.

- **External Dependencies**: Heavy reliance on Appium ecosystem and platform-specific tools (Android SDK, Xcode, Flutter SDK) adds complexity and potential for environment-specific issues.

- **CI Strategy**: Multi-platform CI matrix requires careful configuration for mobile emulators/simulators and desktop builds on appropriate OS runners.

- **Timeline**: 10-14 weeks is realistic given the multi-platform scope, external dependency management, and need for comprehensive examples and documentation.
