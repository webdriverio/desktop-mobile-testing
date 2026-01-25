# Specification: Flutter Service MVP (Item #3a)

> **🚨 CRITICAL BLOCKER - January 2025**
>
> **This spec is BLOCKED pending research outcome.**
>
> **Issue:** Flutter Driver (basis of appium-flutter-driver) was deprecated in Flutter 3.19 (2024).
> **Impact:** Entire technical approach may not be viable with current Flutter versions.
> **Action:** 1-2 week research spike to investigate alternatives (Patrol, integration_test wrappers, etc.)
> **Decision Point:** End of Week 2 - GO/NO-GO on Flutter service entirely
>
> See: `/agent-os/specs/20251020-flutter-service/CRITICAL_BLOCKER.md`

---

**Status:** ⚠️ BLOCKED - Research Phase
**Timeline:** TBD (pending research outcome)
**Scope:** Android (emulator) + macOS (desktop) *if technically feasible*
**Parent Item:** #3 Flutter Service (split into #3a MVP + #3b Expansion)

## Goal

Create a minimal viable Flutter service (`@wdio/flutter-service`) that proves the technical approach works on 2 platforms (Android mobile + macOS desktop) before committing to full multi-platform support. Validates Appium Flutter Driver integration, binary detection patterns, and establishes foundation for platform expansion.

## Why MVP First?

### Lessons from Item #2 Cancellation
- **Avoid premature abstraction** - Don't build for 5 platforms until we prove 2 works
- **Early validation** - Catch issues at week 6 instead of week 17
- **Manageable risk** - 4-6 weeks is trackable, 12-17 weeks is too long
- **Faster feedback** - Working prototype enables user testing sooner

### Platform Selection Rationale
**Android (Mobile):**
- ✅ Most accessible mobile platform (emulator easier than iOS simulator)
- ✅ Critical for "desktop-mobile" repository name
- ✅ Large user base (most Flutter devs target Android)
- ✅ GitHub Actions has good Android emulator support
- ✅ No Apple developer account or macOS required for development

**macOS (Desktop):**
- ✅ Same platform as Electron development/testing
- ✅ Desktop testing is proven (Electron service works)
- ✅ Available in existing CI infrastructure
- ✅ Validates desktop approach alongside mobile

**Deferred to Item #3b:**
- iOS (complex simulator setup, real device requirements, Apple ecosystem)
- Windows (requires Windows runners, different build tools)
- Linux (different desktop environment, AppImage/Snap considerations)

## User Stories

### Core MVP Stories
- As a Flutter Android developer, I want to test my APK with WebdriverIO so that I can validate widget interactions
- As a Flutter macOS developer, I want to test my .app bundle with WebdriverIO so that I can validate desktop functionality
- As a test engineer, I want automatic binary detection so that I don't manually configure paths
- As a CI engineer, I want the service to work in GitHub Actions so that I can run automated tests

### Deferred Stories (Item #3b)
- iOS testing (simulator + real device)
- Windows desktop testing
- Linux desktop testing
- Advanced widget testing features
- Performance profiling
- Screenshot/video capture

## MVP Requirements

### Functional Requirements

#### FR1: Package Setup
- ✅ Create `@wdio/flutter-service` package in monorepo
- ✅ Dual ESM/CJS build using bundler (copy from Electron)
- ✅ TypeScript with proper type definitions
- ✅ Package structure following Electron conventions
- ✅ Dependencies: Appium client (webdriverio), minimal Flutter-specific deps

#### FR2: Binary Detection (Android + macOS)
- ✅ Detect Android APK at `build/app/outputs/flutter-apk/app-debug.apk`
- ✅ Detect macOS .app at `build/macos/Build/Products/Debug/YourApp.app`
- ✅ Parse `pubspec.yaml` for app name and metadata
- ✅ Support debug and release build modes
- ✅ Provide helpful errors when binary not found
- ✅ Support manual binary path override
- ❌ iOS/Windows/Linux detection (deferred to #3b)

#### FR3: Appium Integration
- ✅ Validate Appium server is running (don't manage lifecycle - assume external)
- ✅ Validate `appium-flutter-driver` is installed
- ✅ Configure Appium connection (host/port)
- ✅ Handle connection errors gracefully
- ❌ Auto-start Appium server (keep simple - user manages Appium)
- ❌ Appium version compatibility checking (future enhancement)

#### FR4: Capability Configuration
- ✅ Auto-configure Android capabilities (platformName, app path, etc.)
- ✅ Auto-configure macOS capabilities (platformName, app path, etc.)
- ✅ Support custom capability overrides
- ✅ Merge service-level and capability-level configs
- ❌ Device selection (emulator/real device) - use defaults
- ❌ Platform version specification - use system defaults
- ❌ Multiremote configurations (deferred)

#### FR5: Core Flutter Commands
**Element Finding (Priority):**
- ✅ `browser.flutter.byValueKey(key)` - Most common Flutter selector
- ✅ `browser.flutter.byType(type)` - Find by widget type
- ✅ `browser.flutter.byText(text)` - Find by text content

**Interactions (Priority):**
- ✅ `browser.flutter.tap(element)` - Tap widget
- ✅ `browser.flutter.enterText(element, text)` - Enter text
- ✅ `browser.flutter.scroll(params)` - Scroll view

**Waiting (Priority):**
- ✅ `browser.flutter.waitForWidget(selector)` - Wait for widget to appear

**Deferred Commands (#3b):**
- bySemanticsLabel, byTooltip (less common selectors)
- scrollUntilVisible, drag, longPress (advanced interactions)
- waitForAbsent, waitUntilNoTransientCallbacks (advanced waiting)
- getText, isPresent, isVisible (can use standard WebdriverIO commands)
- getWidgetTree (debugging - nice to have)

#### FR6: Service Lifecycle
**Launcher Service (onPrepare/onComplete):**
- ✅ Implement launcher extending `Services.ServiceInstance`
- ✅ `onPrepare`: Validate Appium, detect binaries, configure capabilities
- ✅ `onComplete`: Cleanup (if needed)
- ✅ Copy structure from Electron's `ElectronLaunchService`

**Worker Service (before/after hooks):**
- ✅ Implement service extending `Services.ServiceInstance`
- ✅ `before`: Register Flutter commands on browser instance
- ✅ `after`: Cleanup resources
- ✅ Copy structure from Electron's `ElectronWorkerService`

#### FR7: Configuration
- ✅ TypeScript interfaces for all options
- ✅ Support environment variables for CI (e.g., `FLUTTER_APP_PATH`)
- ✅ Parse `pubspec.yaml` for project metadata
- ✅ Simple validation (required fields only)
- ❌ Zod schema validation (keep simple for MVP)
- ❌ Complex configuration merging (keep simple)

#### FR8: Logging
- ✅ Use `@wdio/logger` (copy pattern from Electron)
- ✅ Scoped logger: `@wdio/flutter-service`
- ✅ Log binary detection results
- ✅ Log capability configuration
- ✅ Log Appium connection status
- ❌ Debug mode widget tree dumps (deferred)

### Non-Functional Requirements

#### NFR1: Developer Experience
- ✅ Minimal configuration (platform + optional app path)
- ✅ Clear error messages with actionable solutions
- ✅ IntelliSense via TypeScript
- ✅ Basic examples for Android and macOS

#### NFR2: Testing
- ✅ Unit tests for core functionality (>70% coverage)
- ✅ Package tests for both platforms (isolated testing)
- ✅ Basic E2E test (1-2 simple tests per platform)
- ❌ Comprehensive E2E suite (deferred to #3b)

#### NFR3: CI/CD
- ✅ GitHub Actions workflow for Android emulator tests
- ✅ GitHub Actions workflow for macOS tests
- ✅ Reuse Electron's CI patterns
- ❌ iOS simulator setup (complex, deferred)
- ❌ Windows/Linux runners (deferred)

#### NFR4: Documentation
- ✅ README with getting started
- ✅ Basic API documentation
- ✅ Android setup guide
- ✅ macOS setup guide
- ❌ Comprehensive docs site (deferred)

## Technical Design

### Package Structure
```
packages/flutter-service/
├── src/
│   ├── index.ts              # Exports launcher + service
│   ├── launcher.ts            # FlutterLaunchService
│   ├── service.ts             # FlutterWorkerService
│   ├── binaryDetection.ts     # Android + macOS detection
│   ├── capabilities.ts        # Capability builders
│   ├── commands/              # Flutter commands
│   │   ├── byValueKey.ts
│   │   ├── byType.ts
│   │   ├── byText.ts
│   │   ├── tap.ts
│   │   ├── enterText.ts
│   │   ├── scroll.ts
│   │   └── waitForWidget.ts
│   ├── types.ts               # TypeScript interfaces
│   └── logger.ts              # Logger setup
├── test/
│   └── unit/                  # Unit tests
├── package.json
├── tsconfig.json
└── wdio-bundler.config.ts
```

### Binary Detection Strategy
```typescript
// Simplified approach for MVP
interface BinaryPaths {
  android: string; // build/app/outputs/flutter-apk/app-debug.apk
  macos: string;   // build/macos/Build/Products/Debug/{AppName}.app
}

async function detectBinary(platform: 'android' | 'macos'): Promise<string> {
  // 1. Check manual override
  // 2. Parse pubspec.yaml for app name
  // 3. Check standard build output location
  // 4. Return path or throw helpful error
}
```

### Appium Assumptions (Simplified for MVP)
- User has Appium installed globally (`npm install -g appium`)
- User has installed `appium-flutter-driver` (`appium driver install --source=npm appium-flutter-driver`)
- Appium server is running before tests (`appium` or `appium --port 4723`)
- Service validates connection but doesn't manage lifecycle

### Capability Configuration
```typescript
// Android
{
  platformName: 'Android',
  'appium:automationName': 'Flutter',
  'appium:app': '/path/to/app-debug.apk',
  'appium:deviceName': 'emulator-5554', // Default emulator
  'appium:noReset': true,
}

// macOS
{
  platformName: 'mac',
  'appium:automationName': 'Flutter',
  'appium:app': '/path/to/YourApp.app',
}
```

## Out of Scope (Deferred to #3b)

### Platforms
- ❌ iOS (simulator + real device)
- ❌ Windows desktop
- ❌ Linux desktop

### Features
- ❌ Advanced Flutter commands (full command set)
- ❌ Widget testing integration
- ❌ Screenshot/video capture
- ❌ Performance profiling
- ❌ Advanced debugging (widget tree inspector)
- ❌ Standalone mode support
- ❌ Multiremote configurations
- ❌ Custom Appium server management
- ❌ Device selection and management
- ❌ Platform version targeting

### Testing
- ❌ Comprehensive E2E suite (just basic smoke tests)
- ❌ Cross-platform test matrix
- ❌ Performance benchmarks

### Documentation
- ❌ Comprehensive docs site
- ❌ Video tutorials
- ❌ Migration guides from other tools

## Success Criteria

### Must Have (MVP Complete)
- ✅ Package publishes to npm (or workspace)
- ✅ Android APK testing works in CI
- ✅ macOS .app testing works in CI
- ✅ Core 7 commands implemented and working
- ✅ Binary detection works for both platforms
- ✅ Unit tests >70% coverage
- ✅ Package tests pass for both platforms
- ✅ Basic E2E tests pass (1-2 tests per platform)
- ✅ README and basic docs complete
- ✅ Can be used in real Flutter project

### Nice to Have (Not Blocking)
- Advanced error handling
- Comprehensive logging
- Performance optimizations
- Additional command helpers

### Validation Criteria
- Can test a simple Flutter counter app on Android
- Can test a simple Flutter counter app on macOS
- Error messages are helpful when things go wrong
- Setup process is documented and reproducible

## Timeline

### Week 1: Setup & Foundation
- Create package structure (copy from Electron)
- Setup TypeScript, build config, basic tests
- Create Flutter test apps (Android + macOS)
- Validate Appium Flutter Driver works manually

### Week 2: Binary Detection & Capabilities
- Implement Android binary detection
- Implement macOS binary detection
- Implement capability configuration
- Unit tests for detection and capabilities

### Week 3: Service Implementation
- Implement launcher service (onPrepare/onComplete)
- Implement worker service (before/after)
- Integrate binary detection and capabilities
- Unit tests for services

### Week 4: Flutter Commands
- Implement 7 core commands
- Register commands on browser instance
- Integration tests for commands
- Test with real Flutter apps

### Week 5: Testing & CI
- Package tests for Android
- Package tests for macOS
- Basic E2E tests
- GitHub Actions workflows
- Fix bugs found in testing

### Week 6: Documentation & Polish
- README and getting started guide
- API documentation
- Platform setup guides
- Code cleanup and refinement
- Final validation

## Risks & Mitigation

### Risk 1: Appium Flutter Driver Issues
**Risk:** Driver is unmaintained or has blocking bugs
**Mitigation:** Research driver status in next phase, have backup plan (direct Flutter Driver integration)
**Likelihood:** Medium | **Impact:** High

### Risk 2: Android Emulator CI Complexity
**Risk:** Emulator setup in CI is flaky or slow
**Mitigation:** Use established actions (reactivecircus/android-emulator-runner), budget time for troubleshooting
**Likelihood:** Medium | **Impact:** Medium

### Risk 3: Binary Detection Complexity
**Risk:** Flutter build outputs vary more than expected
**Mitigation:** Support manual path override, provide clear error messages
**Likelihood:** Low | **Impact:** Low

### Risk 4: Command Implementation Issues
**Risk:** Appium Flutter Driver commands don't work as expected
**Mitigation:** Test manually first, document workarounds, defer problematic commands
**Likelihood:** Medium | **Impact:** Medium

## Dependencies

### Upstream (Must Complete First)
- ✅ Item #1: Monorepo Foundation ✅ COMPLETE

### Downstream (Blocked by This)
- Item #3b: Flutter Platform Expansion (iOS, Windows, Linux)
- Item #6: Shared Utilities (can't extract until we see duplication)

### External Dependencies
- Appium (user installs)
- appium-flutter-driver (user installs)
- Flutter SDK (user installs)
- Android SDK (user installs)
- Xcode (macOS users have)

## Next: Item #3b Scope

After #3a MVP proves successful, Item #3b will add:

**Platforms:**
- iOS (simulator + real device)
- Windows desktop
- Linux desktop

**Commands:**
- All remaining Flutter Driver commands
- Advanced selectors and interactions
- Debugging commands

**Testing:**
- Comprehensive E2E test suite
- Cross-platform test matrix
- Performance benchmarks

**Features:**
- Standalone mode
- Multiremote support
- Advanced Appium configuration
- Device management

**Documentation:**
- Comprehensive docs site
- Video tutorials
- Migration guides

**Timeline:** 6-8 weeks (builds on validated foundation from #3a)

---

## Research Validation Needed

Before starting implementation, validate:
1. ✅ Appium Flutter Driver is maintained and works
2. ✅ Android emulator can be automated in CI
3. ✅ macOS Flutter builds work in CI
4. ✅ Core commands are feasible with Flutter Driver
5. ✅ Binary detection locations are correct

See: `/agent-os/specs/20251020-flutter-service/RESEARCH.md`

