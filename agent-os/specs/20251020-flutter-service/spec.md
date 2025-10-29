# Specification: Flutter Service Core Architecture

> **🚨 RESEARCH COMPLETE - January 2025**
>
> **SPEC STATUS:** PARKED - Awaiting Further Research
>
> **Research Findings:**
> 1. ✅ **Flutter integration is technically feasible** - Standard Android automation works
> 2. ❌ **flutter-integration-driver is currently broken** - Consistent timeout issues
> 3. ✅ **Alternative approach identified** - Standard Android automation viable
> 4. ⚠️ **Platform limitations** - Android-only with standard automation
> 5. 🔍 **Need more research** - Driver stability, community status, alternatives
>
> **Current Status:** Research spike completed, findings documented
> - **Technical feasibility:** ✅ Proven (Android automation works)
> - **Driver reliability:** ❌ flutter-integration-driver not working
> - **Alternative path:** ✅ Standard Android automation viable
> - **Platform coverage:** ⚠️ Limited (Android-only with current approach)
>
> **Documents:**
> - Complete research findings: `RESEARCH_FINDINGS.md`
> - Research log: `RESEARCH.md`
> - Critical blocker analysis: `CRITICAL_BLOCKER.md`
> - Research spike plan: `RESEARCH_SPIKE_PLAN.md`
>
> **Next Steps:** More research needed on driver alternatives, community status, and long-term viability before proceeding with implementation.

---

## Goal

Implement `@wdio/flutter-service` as a convenience layer over existing Appium Flutter Driver integration, providing automatic binary detection, simplified capability configuration, and WebdriverIO command wrappers for Flutter-specific interactions across all five platforms (iOS, Android, Windows, macOS, Linux).

## User Stories

- As a Flutter mobile developer, I want to test iOS and Android apps with WebdriverIO so that I can validate widget interactions and user flows across mobile platforms
- As a Flutter desktop developer, I want to test Windows, macOS, and Linux apps with the same testing patterns so that I have consistent test code across all desktop platforms
- As a test automation engineer, I want automatic binary detection so that I don't need to manually configure app paths for different Flutter build outputs
- As a CI/CD engineer, I want simplified Appium configuration so that I can set up mobile and desktop testing with minimal boilerplate
- As a Flutter developer, I want convenience commands for common widget interactions (tap, scroll, enterText) so that my test code is readable and maintainable
- As a multiplatform team, I want consistent testing APIs across mobile and desktop so that platform-specific tests share common patterns

## Core Requirements

### Functional Requirements

#### Binary Detection
- Auto-detect Flutter app binaries for all 5 platforms from standard build outputs
- Parse pubspec.yaml for app metadata (name, version, bundle identifier)
- Support debug, release, and profile build modes
- Handle platform-specific binary formats (.apk, .ipa, .app bundles, executables)
- Provide helpful error messages when binaries not found with build command suggestions
- Support manual binary path override via configuration

#### Appium Integration
- Manage Appium server lifecycle (start if not running, detect existing server)
- Validate appium-flutter-driver installation with version compatibility checking
- Configure Appium capabilities automatically based on platform and app path
- Support custom Appium server configuration (host, port, log level)
- Handle Flutter Driver port configuration (default 8181)
- Provide clear error messages for missing Appium dependencies

#### Capability Configuration
- Auto-configure platform-specific Appium capabilities (Android, iOS, Desktop)
- Support device selection (emulators, simulators, real devices via UDID)
- Handle platform version specification (iOS version, Android API level)
- Merge service-level and capability-level configurations with proper precedence
- Support multiremote configurations with per-instance settings
- Provide sensible defaults while allowing complete override flexibility

#### Flutter Commands
- Element finding: byValueKey, byType, byText, bySemanticsLabel, byTooltip
- Interactions: tap, enterText, scroll, scrollUntilVisible, drag, longPress
- Waiting: waitForWidget, waitForAbsent, waitUntilNoTransientCallbacks
- Assertions: getText, isPresent, isVisible
- Debugging: getWidgetTree for widget hierarchy inspection
- Register all commands on browser.flutter namespace

#### Service Lifecycle
- Extend BaseLauncher from @wdio/native-utils for launcher hooks
- Extend BaseService from @wdio/native-utils for service hooks
- Implement onPrepare to start Appium and configure capabilities
- Implement before to register Flutter commands on browser instance
- Handle cleanup in onComplete and after hooks
- Support standalone and testrunner modes

#### Multi-Platform Support
- Mobile platforms: iOS (simulator + real device), Android (emulator + real device)
- Desktop platforms: Windows (x64, arm64), macOS (Intel, Apple Silicon), Linux (x64, arm64)
- Platform-specific capability builders with platform detection
- Handle mobile-specific features (device rotation, background/foreground)
- Handle desktop-specific features (window management, multi-instance)
- Validate platform compatibility and provide platform-specific guidance

#### Configuration Management
- Define comprehensive TypeScript interfaces for all options
- Validate configuration with Zod schema
- Support environment variable overrides for CI/CD
- Parse Flutter project metadata from pubspec.yaml
- Merge configurations: service-level, capability-level, environment, project defaults
- Generate helpful validation error messages

#### Logging and Debugging
- Use @wdio/logger for consistent logging across WebdriverIO ecosystem
- Scoped logger: @wdio/flutter-service
- Log Appium server lifecycle events
- Log binary detection results and paths checked
- Log capability configuration for debugging
- Support debug mode via environment variable or config option
- Optionally dump widget tree on test failures

### Non-Functional Requirements

#### Developer Experience
- Minimal configuration required (platform and optionally app path)
- Automatic setup where possible (Appium, capabilities, Flutter Driver)
- Clear error messages with actionable solutions
- IntelliSense support via TypeScript definitions
- Comprehensive examples for all platforms

#### Performance
- Fast Appium server startup (reuse existing server when possible)
- Efficient binary detection with path caching
- Minimal overhead over direct Appium usage
- No unnecessary command wrapping - thin convenience layer

#### Reliability
- Robust error handling with retry logic for transient failures
- Validate Appium and driver installation before tests run
- Clean resource cleanup (Appium server, connections)
- Handle platform-specific quirks gracefully

#### Compatibility
- Appium 2.x support (latest stable)
- WebdriverIO 9.x support
- Node.js 18+ and 20+ (LTS versions)
- Flutter 3.0+ compatibility
- All 5 platform targets validated in CI

#### Maintainability
- Clear separation: generic utilities in @wdio/native-utils, Flutter-specific code here
- Well-documented extension points for customization
- Consistent coding patterns following project standards
- Easy to extend for future Flutter features
- Follows monorepo conventions (Turborepo, pnpm workspaces)

## Visual Design

Not applicable - this is a testing service package with no UI components.

## Reusable Components

### Existing Code to Leverage

**From @wdio/native-utils (Item #3):**
- BaseLauncher - Service launcher base class with onPrepare/onComplete hooks
- BaseService - Service base class with before/after and command hooks
- BinaryDetector - Abstract base class for framework-specific binary detection
- ConfigReader - Configuration parsing utilities (JSON, YAML, JS/TS)
- PlatformUtils - Platform detection and path handling utilities
- LoggerFactory - Logger creation with @wdio/logger integration
- WindowManager - Window handle management (for desktop platforms)

**From wdio-electron-service (Item #2 - Reference Patterns):**
- Binary detection patterns: multiple path checking, validation, error messages
- Service lifecycle implementation: launcher/service split, hook ordering
- Configuration merging: service-level + capability-level with proper precedence
- Command registration: custom browser commands on namespaced object
- Multi-instance support: multiremote window tracking patterns

**From Existing Appium Ecosystem:**
- appium-flutter-finder: Element finding utilities (byValueKey, byType, etc.)
- Appium Flutter Driver: WebDriver protocol implementation for Flutter
- Appium Server: Standard WebDriver server with Flutter Driver plugin

### New Components Required

**FlutterBinaryDetector (extends BinaryDetector):**
- Why: Flutter build outputs are platform-specific and different from Electron
- What: Detect .apk (Android), .app bundles (iOS/macOS), .exe (Windows), executables (Linux)
- Pattern: Parse pubspec.yaml for metadata, generate platform-specific paths

**FlutterCapabilityBuilder:**
- Why: Each platform (iOS, Android, Windows, macOS, Linux) needs different Appium capabilities
- What: Platform-specific capability generation with sensible defaults
- Pattern: Strategy pattern for platform-specific builders

**AppiumManager:**
- Why: Need to manage Appium server lifecycle separate from Flutter-specific logic
- What: Start/stop Appium server, validate driver installation, port management
- Pattern: Lifecycle manager with health checks

**FlutterCommandRegistry:**
- Why: Flutter commands wrap appium-flutter-finder patterns for better DX
- What: Command implementations that map to Appium Flutter Driver protocol
- Pattern: Facade pattern wrapping appium-flutter-finder and driver methods

**PubspecParser:**
- Why: Need to read Flutter project metadata for binary detection and configuration
- What: Parse pubspec.yaml for app name, bundle ID, version
- Pattern: YAML parser with schema validation

## Technical Approach

### Package Structure

```
packages/@wdio/flutter-service/
├── src/
│   ├── index.ts                          # Main exports
│   ├── launcher.ts                        # FlutterLauncher class
│   ├── service.ts                         # FlutterService class
│   │
│   ├── binary-detection/
│   │   ├── FlutterBinaryDetector.ts       # Extends BinaryDetector
│   │   ├── PlatformPaths.ts               # Platform-specific path patterns
│   │   ├── PubspecParser.ts               # Parse pubspec.yaml
│   │   └── index.ts
│   │
│   ├── capabilities/
│   │   ├── CapabilityBuilder.ts           # Main builder
│   │   ├── AndroidCapabilities.ts         # Android-specific
│   │   ├── IosCapabilities.ts             # iOS-specific
│   │   ├── DesktopCapabilities.ts         # Windows/macOS/Linux
│   │   └── index.ts
│   │
│   ├── commands/
│   │   ├── finder.ts                      # Element finding commands
│   │   ├── interaction.ts                 # Tap, scroll, drag, etc.
│   │   ├── waiting.ts                     # Wait commands
│   │   ├── assertion.ts                   # Text, visibility assertions
│   │   └── index.ts
│   │
│   ├── appium/
│   │   ├── AppiumManager.ts               # Start/stop Appium server
│   │   ├── DriverValidator.ts             # Check appium-flutter-driver
│   │   ├── ServerDetector.ts              # Detect running Appium
│   │   └── index.ts
│   │
│   ├── configuration/
│   │   ├── ConfigSchema.ts                # Zod schema
│   │   ├── ConfigValidator.ts             # Validation logic
│   │   ├── ConfigMerger.ts                # Merge service + capability
│   │   └── index.ts
│   │
│   └── utils/
│       ├── PlatformDetector.ts            # Detect target platform
│       ├── Logger.ts                      # Scoped logger
│       ├── ErrorMessages.ts               # Helpful error text
│       └── index.ts
│
├── test/
│   ├── unit/
│   │   ├── binary-detection/
│   │   │   ├── FlutterBinaryDetector.spec.ts
│   │   │   ├── PlatformPaths.spec.ts
│   │   │   └── PubspecParser.spec.ts
│   │   ├── capabilities/
│   │   │   ├── AndroidCapabilities.spec.ts
│   │   │   ├── IosCapabilities.spec.ts
│   │   │   └── DesktopCapabilities.spec.ts
│   │   ├── commands/
│   │   │   └── *.spec.ts
│   │   ├── appium/
│   │   │   └── *.spec.ts
│   │   └── configuration/
│   │       └── *.spec.ts
│   │
│   └── integration/
│       ├── appium-connection.spec.ts      # Test Appium integration
│       ├── binary-detection-workflow.spec.ts
│       ├── command-execution.spec.ts
│       └── multiplatform-config.spec.ts
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Architecture

#### Service Architecture

```
User Test Code
    ↓
WebdriverIO Test Runner
    ↓
FlutterLauncher (onPrepare)
    ├─→ FlutterBinaryDetector → Detect app binary
    ├─→ AppiumManager → Start Appium server (if needed)
    ├─→ CapabilityBuilder → Configure capabilities
    └─→ WebdriverIO Session Creation
    ↓
FlutterService (before)
    ├─→ Register browser.flutter.* commands
    └─→ Initialize Flutter Driver connection
    ↓
Test Execution
    ├─→ browser.flutter.tap('loginButton')
    ├─→ browser.flutter.enterText('username', 'test')
    └─→ browser.flutter.waitForWidget('homeScreen')
    ↓
Command Execution Flow:
    browser.flutter.tap(key)
        ↓
    FlutterCommandRegistry.tap()
        ↓
    appium-flutter-finder.byValueKey(key)
        ↓
    driver.elementClick(element)
        ↓
    Appium Server
        ↓
    Appium Flutter Driver
        ↓
    Flutter Driver (Dart VM Service Protocol)
        ↓
    Flutter App (Widget interaction)
```

#### Binary Detection Flow

```
FlutterBinaryDetector.detect()
    ↓
1. Check manual override (config.appPath)
    ↓
2. Parse pubspec.yaml
    ├─→ Extract app name
    ├─→ Extract bundle identifier
    └─→ Determine build mode (debug/release/profile)
    ↓
3. Detect platform (from config or app path)
    ↓
4. Generate platform-specific paths
    ├─→ Android: build/app/outputs/flutter-apk/app-{mode}.apk
    ├─→ iOS (simulator): build/ios/iphonesimulator/Runner.app
    ├─→ iOS (device): build/ios/iphoneos/Runner.app
    ├─→ macOS: build/macos/Build/Products/{Mode}/{AppName}.app
    ├─→ Windows: build/windows/x64/runner/{Mode}/{appname}.exe
    └─→ Linux: build/linux/x64/{mode}/bundle/{appname}
    ↓
5. Validate paths (exists, executable, not corrupted)
    ↓
6. Return first valid path or throw with helpful error
```

#### Capability Configuration Flow

```
CapabilityBuilder.build(platform, config)
    ↓
Platform Detection
    ├─→ Android → AndroidCapabilities.build()
    ├─→ iOS → IosCapabilities.build()
    └─→ Desktop → DesktopCapabilities.build()
    ↓
Base Capabilities (all platforms)
    {
      'appium:automationName': 'Flutter',
      'appium:app': detectedAppPath,
      'appium:retries': 0
    }
    ↓
Platform-Specific Capabilities
    Android:
        platformName: 'Android',
        'appium:deviceName': config.deviceName || 'Android Emulator',
        'appium:platformVersion': config.platformVersion

    iOS:
        platformName: 'iOS',
        'appium:deviceName': config.deviceName || 'iPhone Simulator',
        'appium:platformVersion': config.platformVersion || '15.0',
        'appium:udid': config.deviceUdid (if specified)

    Desktop (Windows/macOS/Linux):
        platformName: 'Desktop',
        'appium:app': appPath (full path to executable/bundle)
    ↓
Merge with User Capabilities (user takes precedence)
    ↓
Return Final Capabilities
```

### Database

Not applicable - this is a testing service with no database requirements.

### API

Not applicable - this package provides TypeScript/JavaScript APIs for WebdriverIO, not HTTP APIs.

The key APIs exposed are:

**Service Configuration API:**
```typescript
// wdio.conf.js
export const config = {
  services: [
    ['flutter', {
      // Platform (required)
      platform: 'android' | 'ios' | 'windows' | 'macos' | 'linux',

      // Binary detection (optional - auto-detected if not provided)
      appPath?: string,
      buildMode?: 'debug' | 'release' | 'profile',

      // Appium configuration (optional - sensible defaults)
      appiumHost?: string,
      appiumPort?: number,
      appiumLogLevel?: string,

      // Flutter Driver configuration (optional)
      flutterDriverPort?: number,
      observatoryPort?: number,

      // Device configuration (optional)
      deviceName?: string,
      deviceUdid?: string,
      platformVersion?: string,

      // Advanced (optional)
      customCapabilities?: Record<string, any>,
      skipAppiumInstallCheck?: boolean
    }]
  ]
};
```

**Browser Command API:**
```typescript
// In test files
describe('Flutter App Test', () => {
  it('should interact with Flutter widgets', async () => {
    // Element finding
    await browser.flutter.waitForWidget('loginScreen');

    // Interactions
    await browser.flutter.tap('loginButton');
    await browser.flutter.enterText('usernameField', 'testuser');
    await browser.flutter.scroll('listView', { direction: 'down', pixels: 100 });
    await browser.flutter.scrollUntilVisible('itemKey', 'scrollable');
    await browser.flutter.drag('slider', { dx: 50, dy: 0 });
    await browser.flutter.longPress('menuButton');

    // Waiting
    await browser.flutter.waitForWidget('homeScreen', 5000);
    await browser.flutter.waitForAbsent('loadingSpinner', 3000);
    await browser.flutter.waitUntilNoTransientCallbacks();

    // Assertions
    const text = await browser.flutter.getText('titleText');
    const isPresent = await browser.flutter.isPresent('errorMessage');
    const isVisible = await browser.flutter.isVisible('submitButton');

    // Debugging
    const widgetTree = await browser.flutter.getWidgetTree();
    console.log(widgetTree);
  });
});
```

### Frontend

Not applicable - this is a Node.js testing service with no frontend components.

### Testing Strategy

#### Unit Tests (80%+ coverage required)

**Binary Detection Tests:**
```typescript
describe('FlutterBinaryDetector', () => {
  it('should detect Android APK in standard location', async () => {
    const detector = new FlutterBinaryDetector({ platform: 'android' });
    const path = await detector.detect(projectRoot);
    expect(path).toContain('app-release.apk');
  });

  it('should parse pubspec.yaml correctly', async () => {
    const parser = new PubspecParser();
    const metadata = await parser.parse(projectRoot);
    expect(metadata.name).toBe('my_app');
    expect(metadata.version).toBe('1.0.0');
  });

  it('should handle missing binary with helpful error', async () => {
    const detector = new FlutterBinaryDetector({ platform: 'ios' });
    await expect(detector.detect(emptyProject)).rejects.toThrow(
      /Could not find iOS app bundle.*flutter build ios/
    );
  });
});
```

**Capability Configuration Tests:**
```typescript
describe('CapabilityBuilder', () => {
  it('should build Android capabilities', () => {
    const builder = new CapabilityBuilder();
    const caps = builder.build('android', {
      appPath: '/path/to/app.apk',
      deviceName: 'Pixel 5'
    });

    expect(caps).toMatchObject({
      platformName: 'Android',
      'appium:automationName': 'Flutter',
      'appium:app': '/path/to/app.apk',
      'appium:deviceName': 'Pixel 5'
    });
  });

  it('should merge user capabilities with priority', () => {
    const builder = new CapabilityBuilder();
    const caps = builder.build('ios', {
      appPath: '/path/to/app.app',
      customCapabilities: {
        'appium:platformVersion': '16.0' // Override default
      }
    });

    expect(caps['appium:platformVersion']).toBe('16.0');
  });
});
```

**Command Tests:**
```typescript
describe('Flutter Commands', () => {
  it('should tap widget by value key', async () => {
    const mockDriver = createMockDriver();
    const tap = createTapCommand(mockDriver);

    await tap('loginButton');

    expect(mockDriver.elementClick).toHaveBeenCalledWith(
      expect.objectContaining({ ELEMENT: expect.any(String) })
    );
  });

  it('should enter text in widget', async () => {
    const mockDriver = createMockDriver();
    const enterText = createEnterTextCommand(mockDriver);

    await enterText('usernameField', 'testuser');

    expect(mockDriver.elementSendKeys).toHaveBeenCalledWith(
      expect.any(Object),
      'testuser'
    );
  });
});
```

**Appium Manager Tests:**
```typescript
describe('AppiumManager', () => {
  it('should detect running Appium server', async () => {
    const manager = new AppiumManager({ port: 4723 });
    const isRunning = await manager.isServerRunning();
    expect(isRunning).toBe(true);
  });

  it('should start Appium server if not running', async () => {
    const manager = new AppiumManager({ port: 4723 });
    await manager.ensureServerRunning();
    expect(manager.serverProcess).toBeDefined();
  });

  it('should validate appium-flutter-driver installation', async () => {
    const validator = new DriverValidator();
    const isInstalled = await validator.isFlutterDriverInstalled();
    expect(isInstalled).toBe(true);
  });
});
```

#### Integration Tests

**Appium Connection Workflow:**
```typescript
describe('Appium Integration', () => {
  it('should connect to Flutter app via Appium', async () => {
    const launcher = new FlutterLauncher({
      platform: 'android',
      appPath: testAppPath
    });

    await launcher.onPrepare(config, capabilities);

    // Verify Appium started
    expect(launcher.appiumManager.isRunning()).toBe(true);

    // Verify capabilities configured
    expect(capabilities[0]).toMatchObject({
      'appium:automationName': 'Flutter'
    });
  });
});
```

**Binary Detection Workflow:**
```typescript
describe('Binary Detection Workflow', () => {
  it('should detect binary from Flutter project', async () => {
    const detector = new FlutterBinaryDetector({ platform: 'android' });
    const path = await detector.detect(flutterProjectPath);

    expect(path).toMatch(/\.apk$/);
    expect(fs.existsSync(path)).toBe(true);
  });
});
```

**Command Execution Workflow:**
```typescript
describe('Command Execution', () => {
  it('should execute Flutter commands end-to-end', async () => {
    // Mock Appium driver with realistic responses
    const mockDriver = createRealisticMockDriver();

    // Register commands
    const service = new FlutterService();
    await service.before({}, [], mockDriver);

    // Execute commands
    await mockDriver.flutter.tap('button');
    await mockDriver.flutter.enterText('field', 'text');

    // Verify command execution
    expect(mockDriver.execute).toHaveBeenCalled();
  });
});
```

#### E2E Tests (Example Applications)

**Test against real Flutter apps:**
```
examples/flutter/
├── mobile/
│   ├── android/                  # Android example app
│   │   ├── app/
│   │   ├── pubspec.yaml
│   │   └── test_driver/
│   │       └── integration_test.dart
│   │
│   └── ios/                      # iOS example app
│       ├── Runner.xcworkspace
│       ├── pubspec.yaml
│       └── test_driver/
│
├── desktop/
│   ├── windows/                  # Windows example app
│   ├── macos/                    # macOS example app
│   └── linux/                    # Linux example app
│
└── test/
    └── specs/
        ├── android.e2e.ts
        ├── ios.e2e.ts
        ├── windows.e2e.ts
        ├── macos.e2e.ts
        └── linux.e2e.ts
```

**Example E2E Test:**
```typescript
// examples/flutter/test/specs/android.e2e.ts
describe('Flutter Android App', () => {
  it('should complete login flow', async () => {
    await browser.flutter.waitForWidget('loginScreen');

    await browser.flutter.enterText('usernameField', 'testuser');
    await browser.flutter.enterText('passwordField', 'password123');
    await browser.flutter.tap('loginButton');

    await browser.flutter.waitForWidget('homeScreen', 10000);

    const welcomeText = await browser.flutter.getText('welcomeMessage');
    expect(welcomeText).toContain('Welcome, testuser');
  });

  it('should navigate between screens', async () => {
    await browser.flutter.tap('settingsTab');
    await browser.flutter.waitForWidget('settingsScreen');

    await browser.flutter.tap('profileOption');
    await browser.flutter.waitForWidget('profileScreen');
  });

  it('should scroll and find items in list', async () => {
    await browser.flutter.tap('listTab');
    await browser.flutter.scrollUntilVisible('item50', 'listView');

    const isVisible = await browser.flutter.isVisible('item50');
    expect(isVisible).toBe(true);
  });
});
```

#### Multi-Platform CI Testing

**GitHub Actions Matrix:**
```yaml
jobs:
  test-flutter-service:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        platform: [android, ios, windows, macos, linux]
        exclude:
          # iOS only on macOS
          - os: ubuntu-latest
            platform: ios
          - os: windows-latest
            platform: ios
          # Windows only on Windows
          - os: ubuntu-latest
            platform: windows
          - os: macos-latest
            platform: windows
          # macOS only on macOS
          - os: ubuntu-latest
            platform: macos
          - os: windows-latest
            platform: macos
          # Linux only on ubuntu
          - os: windows-latest
            platform: linux
          - os: macos-latest
            platform: linux
          # Android everywhere (via emulator)

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      # Set up platform-specific tools
      - name: Set up Android SDK (Android only)
        if: matrix.platform == 'android'
        uses: android-actions/setup-android@v3

      - name: Set up Xcode (iOS only)
        if: matrix.platform == 'ios'
        uses: maxim-lobanov/setup-xcode@v1

      # Install dependencies
      - run: pnpm install

      # Build packages
      - run: pnpm turbo run build --filter=@wdio/flutter-service

      # Run unit tests
      - run: pnpm turbo run test:unit --filter=@wdio/flutter-service

      # Build example app
      - name: Build Flutter example
        working-directory: examples/flutter/${{ matrix.platform }}
        run: flutter build ${{ matrix.platform }}

      # Run E2E tests
      - run: pnpm turbo run test:e2e:${{ matrix.platform }}

      # Upload coverage
      - uses: codecov/codecov-action@v3
```

## Implementation Details

### Binary Detection Algorithms

#### Android Binary Detection
```typescript
class AndroidBinaryDetector {
  generatePaths(config: FlutterConfig): string[] {
    const { buildMode = 'release' } = config;

    return [
      // Standard Flutter build output
      `build/app/outputs/flutter-apk/app-${buildMode}.apk`,

      // Alternative debug location
      'build/app/outputs/apk/debug/app-debug.apk',

      // Alternative release location
      'build/app/outputs/apk/release/app-release.apk',

      // Flavor-specific builds
      `build/app/outputs/flutter-apk/app-${config.flavor}-${buildMode}.apk`,
    ];
  }
}
```

#### iOS Binary Detection
```typescript
class IosBinaryDetector {
  generatePaths(config: FlutterConfig): string[] {
    const { buildMode = 'Release', targetDevice = 'simulator' } = config;
    const capitalizedMode = buildMode.charAt(0).toUpperCase() + buildMode.slice(1);

    const paths = [];

    // Simulator builds
    if (targetDevice === 'simulator' || !targetDevice) {
      paths.push(
        `build/ios/iphonesimulator/Runner.app`,
        `build/ios/Build/Products/${capitalizedMode}-iphonesimulator/Runner.app`
      );
    }

    // Device builds
    if (targetDevice === 'device' || !targetDevice) {
      paths.push(
        `build/ios/iphoneos/Runner.app`,
        `build/ios/Build/Products/${capitalizedMode}-iphoneos/Runner.app`
      );
    }

    return paths;
  }
}
```

#### macOS Binary Detection
```typescript
class MacOsBinaryDetector {
  async generatePaths(config: FlutterConfig): Promise<string[]> {
    const { buildMode = 'Release' } = config;
    const capitalizedMode = buildMode.charAt(0).toUpperCase() + buildMode.slice(1);

    // Parse pubspec.yaml for app name
    const pubspec = await this.parsePubspec(config.projectRoot);
    const appName = this.getAppName(pubspec);

    return [
      `build/macos/Build/Products/${capitalizedMode}/${appName}.app`,
      `build/macos/Build/Products/${capitalizedMode}/Runner.app`,
    ];
  }
}
```

#### Windows Binary Detection
```typescript
class WindowsBinaryDetector {
  async generatePaths(config: FlutterConfig): Promise<string[]> {
    const { buildMode = 'release' } = config;
    const pubspec = await this.parsePubspec(config.projectRoot);
    const appName = this.getExecutableName(pubspec);

    return [
      // x64 builds
      `build/windows/x64/runner/${buildMode}/${appName}.exe`,
      `build/windows/runner/${buildMode}/${appName}.exe`,

      // arm64 builds
      `build/windows/arm64/runner/${buildMode}/${appName}.exe`,
    ];
  }
}
```

#### Linux Binary Detection
```typescript
class LinuxBinaryDetector {
  async generatePaths(config: FlutterConfig): Promise<string[]> {
    const { buildMode = 'release' } = config;
    const pubspec = await this.parsePubspec(config.projectRoot);
    const appName = this.getExecutableName(pubspec);

    return [
      // x64 builds
      `build/linux/x64/${buildMode}/bundle/${appName}`,
      `build/linux/${buildMode}/bundle/${appName}`,

      // arm64 builds
      `build/linux/arm64/${buildMode}/bundle/${appName}`,
    ];
  }
}
```

### Capability Builders

#### Android Capabilities
```typescript
class AndroidCapabilities {
  build(config: FlutterServiceOptions): Capabilities {
    return {
      platformName: 'Android',
      'appium:automationName': 'Flutter',
      'appium:app': config.appPath,
      'appium:deviceName': config.deviceName || 'Android Emulator',
      'appium:platformVersion': config.platformVersion,
      'appium:udid': config.deviceUdid,
      'appium:retries': 0,
      'appium:observatoryPort': config.observatoryPort || 8181,
      ...config.customCapabilities
    };
  }
}
```

#### iOS Capabilities
```typescript
class IosCapabilities {
  build(config: FlutterServiceOptions): Capabilities {
    return {
      platformName: 'iOS',
      'appium:automationName': 'Flutter',
      'appium:app': config.appPath,
      'appium:deviceName': config.deviceName || 'iPhone Simulator',
      'appium:platformVersion': config.platformVersion || '15.0',
      'appium:udid': config.deviceUdid,
      'appium:retries': 0,
      'appium:observatoryPort': config.observatoryPort || 8181,
      ...config.customCapabilities
    };
  }
}
```

#### Desktop Capabilities
```typescript
class DesktopCapabilities {
  build(config: FlutterServiceOptions): Capabilities {
    return {
      platformName: 'Desktop',
      'appium:automationName': 'Flutter',
      'appium:app': config.appPath,
      'appium:retries': 0,
      'appium:observatoryPort': config.observatoryPort || 8181,
      ...config.customCapabilities
    };
  }
}
```

### Command Wrappers

#### Element Finding Commands
```typescript
import { byValueKey, byType, byText, bySemanticsLabel, byTooltip } from 'appium-flutter-finder';

export function createFinderCommands(driver: WebDriver) {
  return {
    async byValueKey(key: string): Promise<Element> {
      return await driver.findElement(byValueKey(key));
    },

    async byType(type: string): Promise<Element> {
      return await driver.findElement(byType(type));
    },

    async byText(text: string): Promise<Element> {
      return await driver.findElement(byText(text));
    },

    async bySemanticsLabel(label: string): Promise<Element> {
      return await driver.findElement(bySemanticsLabel(label));
    },

    async byTooltip(tooltip: string): Promise<Element> {
      return await driver.findElement(byTooltip(tooltip));
    }
  };
}
```

#### Interaction Commands
```typescript
export function createInteractionCommands(driver: WebDriver) {
  return {
    async tap(key: string): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:waitFor', { element, timeout: 5000 });
      await driver.elementClick(element);
    },

    async enterText(key: string, text: string): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:waitFor', { element, timeout: 5000 });
      await driver.elementSendKeys(element, text);
    },

    async scroll(key: string, options: ScrollOptions): Promise<void> {
      const { direction = 'down', pixels = 100 } = options;
      await driver.execute('flutter:scroll', {
        finder: byValueKey(key),
        direction,
        distance: pixels
      });
    },

    async scrollUntilVisible(itemKey: string, scrollableKey: string): Promise<void> {
      await driver.execute('flutter:scrollUntilVisible', {
        finder: byValueKey(itemKey),
        scrollable: byValueKey(scrollableKey)
      });
    },

    async drag(key: string, offset: { dx: number; dy: number }): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:drag', {
        finder: element,
        dx: offset.dx,
        dy: offset.dy
      });
    },

    async longPress(key: string, duration: number = 1000): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:longPress', {
        finder: element,
        duration
      });
    }
  };
}
```

#### Waiting Commands
```typescript
export function createWaitingCommands(driver: WebDriver) {
  return {
    async waitForWidget(key: string, timeout: number = 5000): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:waitFor', { element, timeout });
    },

    async waitForAbsent(key: string, timeout: number = 5000): Promise<void> {
      const element = byValueKey(key);
      await driver.execute('flutter:waitForAbsent', { element, timeout });
    },

    async waitUntilNoTransientCallbacks(timeout: number = 5000): Promise<void> {
      await driver.execute('flutter:waitForCondition', {
        condition: 'NoTransientCallbacks',
        timeout
      });
    }
  };
}
```

#### Assertion Commands
```typescript
export function createAssertionCommands(driver: WebDriver) {
  return {
    async getText(key: string): Promise<string> {
      const element = byValueKey(key);
      return await driver.execute('flutter:getText', { finder: element });
    },

    async isPresent(key: string): Promise<boolean> {
      try {
        const element = byValueKey(key);
        await driver.findElement(element);
        return true;
      } catch (err) {
        return false;
      }
    },

    async isVisible(key: string): Promise<boolean> {
      const element = byValueKey(key);
      const result = await driver.execute('flutter:isVisible', { finder: element });
      return result;
    },

    async getWidgetTree(): Promise<string> {
      return await driver.execute('flutter:getRenderObjectDiagnostics');
    }
  };
}
```

### Error Handling

#### Binary Detection Errors
```typescript
class BinaryNotFoundError extends Error {
  constructor(platform: string, searchedPaths: string[]) {
    const buildCommand = getBuildCommand(platform);
    super(
      `Could not find Flutter ${platform} binary.\n\n` +
      `Searched paths:\n${searchedPaths.map(p => `  - ${p}`).join('\n')}\n\n` +
      `Please build your Flutter app first:\n  ${buildCommand}\n\n` +
      `Or specify the app path manually in your wdio.conf.js:\n` +
      `  services: [['flutter', { platform: '${platform}', appPath: '/path/to/app' }]]`
    );
  }
}

function getBuildCommand(platform: string): string {
  const commands = {
    android: 'flutter build apk',
    ios: 'flutter build ios',
    windows: 'flutter build windows',
    macos: 'flutter build macos',
    linux: 'flutter build linux'
  };
  return commands[platform] || 'flutter build';
}
```

#### Appium Driver Validation Errors
```typescript
class DriverNotInstalledError extends Error {
  constructor() {
    super(
      'appium-flutter-driver is not installed.\n\n' +
      'Please install it:\n' +
      '  npm install -g appium-flutter-driver\n' +
      '  appium driver install --source=npm appium-flutter-driver\n\n' +
      'Or install locally in your project:\n' +
      '  npm install --save-dev appium-flutter-driver'
    );
  }
}
```

#### Configuration Validation Errors
```typescript
class InvalidPlatformError extends Error {
  constructor(platform: string) {
    super(
      `Invalid platform: "${platform}".\n\n` +
      `Supported platforms:\n` +
      `  - android\n` +
      `  - ios\n` +
      `  - windows\n` +
      `  - macos\n` +
      `  - linux\n\n` +
      `Update your wdio.conf.js:\n` +
      `  services: [['flutter', { platform: 'android' }]]`
    );
  }
}
```

## Configuration

### Complete Configuration Schema

```typescript
import { z } from 'zod';

export const FlutterServiceOptionsSchema = z.object({
  // Platform (required)
  platform: z.enum(['android', 'ios', 'windows', 'macos', 'linux']),

  // Binary detection (optional - auto-detected if not provided)
  appPath: z.string().optional(),
  buildMode: z.enum(['debug', 'release', 'profile']).default('release'),
  flavor: z.string().optional(),
  projectRoot: z.string().optional(),

  // Appium configuration (optional - sensible defaults)
  appiumHost: z.string().default('localhost'),
  appiumPort: z.number().default(4723),
  appiumPath: z.string().optional(),
  appiumLogLevel: z.enum(['info', 'debug', 'warn', 'error']).default('info'),

  // Flutter Driver configuration (optional)
  flutterDriverPort: z.number().default(8181),
  observatoryPort: z.number().default(8181),
  enableFlutterDriverLog: z.boolean().default(false),

  // Device configuration (optional - platform-specific)
  deviceName: z.string().optional(),
  deviceUdid: z.string().optional(),
  platformVersion: z.string().optional(),
  targetDevice: z.enum(['simulator', 'device']).optional(), // iOS only

  // Timeouts (optional)
  commandTimeout: z.number().default(60000),
  elementTimeout: z.number().default(5000),

  // Advanced (optional)
  customCapabilities: z.record(z.any()).optional(),
  skipAppiumInstallCheck: z.boolean().default(false),

  // Debugging (optional)
  debugMode: z.boolean().default(false),
  dumpWidgetTreeOnFailure: z.boolean().default(false)
});

export type FlutterServiceOptions = z.infer<typeof FlutterServiceOptionsSchema>;
```

### Configuration Examples

#### Android Configuration
```typescript
// wdio.conf.js - Android Emulator
export const config = {
  services: [
    ['flutter', {
      platform: 'android',
      // Auto-detects build/app/outputs/flutter-apk/app-release.apk
      deviceName: 'Pixel_5_API_31'
    }]
  ],
  capabilities: [{
    browserName: '',
    'appium:platformName': 'Android'
  }]
};

// Android Real Device
export const config = {
  services: [
    ['flutter', {
      platform: 'android',
      appPath: './build/app/outputs/flutter-apk/app-release.apk',
      deviceUdid: '0123456789ABCDEF', // adb devices
      platformVersion: '12'
    }]
  ]
};
```

#### iOS Configuration
```typescript
// wdio.conf.js - iOS Simulator
export const config = {
  services: [
    ['flutter', {
      platform: 'ios',
      targetDevice: 'simulator',
      deviceName: 'iPhone 14 Pro',
      platformVersion: '16.0'
    }]
  ]
};

// iOS Real Device
export const config = {
  services: [
    ['flutter', {
      platform: 'ios',
      targetDevice: 'device',
      appPath: './build/ios/iphoneos/Runner.app',
      deviceUdid: '00008110-001A3D2C0A01801E', // instruments -s devices
      platformVersion: '16.0'
    }]
  ]
};
```

#### Desktop Configuration
```typescript
// wdio.conf.js - Windows
export const config = {
  services: [
    ['flutter', {
      platform: 'windows',
      buildMode: 'release'
      // Auto-detects build/windows/x64/runner/release/myapp.exe
    }]
  ]
};

// macOS
export const config = {
  services: [
    ['flutter', {
      platform: 'macos',
      appPath: './build/macos/Build/Products/Release/MyApp.app'
    }]
  ]
};

// Linux
export const config = {
  services: [
    ['flutter', {
      platform: 'linux',
      buildMode: 'debug'
      // Auto-detects build/linux/x64/debug/bundle/myapp
    }]
  ]
};
```

#### Multiremote Configuration
```typescript
// wdio.conf.js - Test Android + iOS simultaneously
export const config = {
  capabilities: {
    androidApp: {
      capabilities: {
        browserName: '',
        'wdio:flutterServiceOptions': {
          platform: 'android',
          deviceName: 'Pixel_5'
        }
      }
    },
    iosApp: {
      capabilities: {
        browserName: '',
        'wdio:flutterServiceOptions': {
          platform: 'ios',
          deviceName: 'iPhone 14',
          platformVersion: '16.0'
        }
      }
    }
  },
  services: [
    ['flutter', {
      // Service-level defaults (can be overridden per capability)
      appiumHost: 'localhost',
      appiumPort: 4723
    }]
  ]
};
```

### Migration from Pure Appium

**Before (Pure Appium):**
```javascript
import { byValueKey } from 'appium-flutter-finder';

export const config = {
  port: 4723,
  services: ['appium'],
  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'Flutter',
    'appium:app': '/Users/me/project/build/app/outputs/flutter-apk/app-release.apk',
    'appium:deviceName': 'Android Emulator',
    'appium:retries': 0
  }]
};

// In tests - verbose
describe('Flutter App', () => {
  it('should login', async () => {
    const usernameField = byValueKey('username');
    await driver.elementSendKeys(usernameField, 'testuser');

    const passwordField = byValueKey('password');
    await driver.elementSendKeys(passwordField, 'pass123');

    const loginButton = byValueKey('loginButton');
    await driver.elementClick(loginButton);
  });
});
```

**After (@wdio/flutter-service):**
```javascript
export const config = {
  services: [
    ['flutter', {
      platform: 'android'
      // Auto-detects app, configures Appium
    }]
  ]
};

// In tests - concise
describe('Flutter App', () => {
  it('should login', async () => {
    await browser.flutter.enterText('username', 'testuser');
    await browser.flutter.enterText('password', 'pass123');
    await browser.flutter.tap('loginButton');
  });
});
```

## Example Applications

### Mobile Examples Structure

```
examples/flutter/mobile/
├── android/
│   ├── android/
│   ├── lib/
│   │   └── main.dart          # Simple app with login, list, navigation
│   ├── pubspec.yaml
│   ├── wdio.conf.js           # Android-specific config
│   └── test/
│       └── specs/
│           ├── login.e2e.ts
│           ├── navigation.e2e.ts
│           └── list.e2e.ts
│
└── ios/
    ├── ios/
    ├── lib/
    │   └── main.dart          # Same app as Android
    ├── pubspec.yaml
    ├── wdio.conf.js           # iOS-specific config
    └── test/
        └── specs/
            └── *.e2e.ts       # Shared tests
```

### Desktop Examples Structure

```
examples/flutter/desktop/
├── windows/
│   ├── windows/
│   ├── lib/
│   │   └── main.dart          # Desktop-optimized app
│   ├── pubspec.yaml
│   ├── wdio.conf.js
│   └── test/
│       └── specs/
│
├── macos/
│   ├── macos/
│   ├── lib/
│   │   └── main.dart
│   ├── pubspec.yaml
│   ├── wdio.conf.js
│   └── test/
│
└── linux/
    ├── linux/
    ├── lib/
    │   └── main.dart
    ├── pubspec.yaml
    ├── wdio.conf.js
    └── test/
```

### Example App Features

**Key Widgets (with ValueKeys for testing):**
- Login screen: username field, password field, login button
- Home screen: navigation tabs, welcome message
- List screen: scrollable list with 100+ items
- Settings screen: toggle switches, dropdowns
- Navigation: bottom navigation bar, drawer

**Example Test Patterns:**
```typescript
// login.e2e.ts
describe('Login Flow', () => {
  it('should login successfully', async () => {
    await browser.flutter.waitForWidget('loginScreen');
    await browser.flutter.enterText('usernameField', 'test@example.com');
    await browser.flutter.enterText('passwordField', 'password123');
    await browser.flutter.tap('loginButton');
    await browser.flutter.waitForWidget('homeScreen', 10000);
  });

  it('should show error on invalid credentials', async () => {
    await browser.flutter.enterText('usernameField', 'wrong');
    await browser.flutter.enterText('passwordField', 'wrong');
    await browser.flutter.tap('loginButton');

    const isErrorVisible = await browser.flutter.isVisible('errorMessage');
    expect(isErrorVisible).toBe(true);
  });
});

// list.e2e.ts
describe('List Scrolling', () => {
  it('should scroll to item and tap', async () => {
    await browser.flutter.tap('listTab');
    await browser.flutter.waitForWidget('listScreen');

    await browser.flutter.scrollUntilVisible('item75', 'listView');
    await browser.flutter.tap('item75');

    await browser.flutter.waitForWidget('detailScreen');
    const title = await browser.flutter.getText('detailTitle');
    expect(title).toContain('Item 75');
  });
});

// navigation.e2e.ts
describe('Navigation', () => {
  it('should navigate between tabs', async () => {
    await browser.flutter.tap('homeTab');
    await browser.flutter.waitForWidget('homeScreen');

    await browser.flutter.tap('settingsTab');
    await browser.flutter.waitForWidget('settingsScreen');

    await browser.flutter.tap('profileTab');
    await browser.flutter.waitForWidget('profileScreen');
  });
});
```

## Migration Strategy

### From Pure Appium Setup

**Step 1: Install Package**
```bash
npm install --save-dev @wdio/flutter-service

# Or with pnpm
pnpm add -D @wdio/flutter-service
```

**Step 2: Update Configuration**
```diff
// wdio.conf.js
export const config = {
- port: 4723,
- services: ['appium'],
+ services: [
+   ['flutter', {
+     platform: 'android'  // or ios, windows, macos, linux
+   }]
+ ],
  capabilities: [{
-   platformName: 'Android',
-   'appium:automationName': 'Flutter',
-   'appium:app': '/long/path/to/app.apk',
-   'appium:deviceName': 'Android Emulator',
-   'appium:retries': 0
+   browserName: ''
  }]
};
```

**Step 3: Simplify Tests**
```diff
-import { byValueKey } from 'appium-flutter-finder';

describe('Login', () => {
  it('should enter credentials', async () => {
-   const usernameField = byValueKey('username');
-   await driver.elementSendKeys(usernameField, 'test');
+   await browser.flutter.enterText('username', 'test');

-   const passwordField = byValueKey('password');
-   await driver.elementSendKeys(passwordField, 'pass');
+   await browser.flutter.enterText('password', 'pass');
  });
});
```

**Step 4: Remove Manual Appium Management**
```diff
-// Remove Appium service configuration
-// Remove manual capability setup
-// Keep browser.flutter commands
```

### Configuration Migration Patterns

**Device Selection:**
```javascript
// Before: Manual UDID in capabilities
capabilities: [{
  'appium:udid': '00008110-001A3D2C0A01801E'
}]

// After: Service option
services: [['flutter', {
  platform: 'ios',
  deviceUdid: '00008110-001A3D2C0A01801E'
}]]
```

**Custom Capabilities:**
```javascript
// Before: All manual
capabilities: [{
  platformName: 'Android',
  'appium:automationName': 'Flutter',
  'appium:app': '/path/to/app.apk',
  'appium:noReset': true,
  'appium:fullReset': false
}]

// After: Merge with service defaults
services: [['flutter', {
  platform: 'android',
  customCapabilities: {
    'appium:noReset': true,
    'appium:fullReset': false
  }
}]]
```

## Dependencies

### Upstream Dependencies (Required)

**Item #1: Monorepo Foundation**
- pnpm workspaces for package management
- Turborepo for build orchestration
- Shared TypeScript configurations
- CI/CD pipeline infrastructure

**Item #2: Electron Service Migration**
- Reference implementation patterns
- Service lifecycle examples
- Binary detection patterns
- Configuration merging strategies

**Item #3: Shared Core Utilities (MUST be complete)**
- BaseLauncher class for launcher implementation
- BaseService class for service implementation
- BinaryDetector abstract class for binary detection
- ConfigReader for configuration parsing
- PlatformUtils for platform detection
- LoggerFactory for logging
- Testing utilities for mocks

### External Dependencies

**Peer Dependencies:**
```json
{
  "peerDependencies": {
    "webdriverio": "^9.0.0",
    "appium": "^2.0.0"
  }
}
```

**Direct Dependencies:**
```json
{
  "dependencies": {
    "@wdio/native-utils": "workspace:*",
    "@wdio/logger": "^9.0.0",
    "appium-flutter-finder": "^1.5.0",
    "yaml": "^2.3.0",
    "zod": "^3.22.0",
    "get-port": "^7.0.0",
    "debug": "^4.3.0"
  }
}
```

**Dev Dependencies:**
```json
{
  "devDependencies": {
    "vitest": "^3.2.0",
    "@vitest/coverage-v8": "^3.2.0",
    "typescript": "^5.9.0",
    "@biomejs/biome": "^2.2.5",
    "@types/node": "^20.0.0",
    "@types/debug": "^4.1.0"
  }
}
```

### Downstream Dependencies

**Item #5: Flutter Service Widget Testing Integration**
- Will build on this foundation
- Add advanced widget testing features
- Screenshot comparison utilities
- Visual regression testing

**Item #10: Cross-Service Testing**
- Will validate Flutter service with comprehensive E2E tests
- Compare patterns across Electron, Flutter, Neutralino, Tauri

### Platform-Specific Tools

**Android:**
- Android SDK (for building and running emulators)
- Android Emulator or real device
- adb (Android Debug Bridge)

**iOS:**
- Xcode (macOS only)
- iOS Simulator or real device
- instruments command-line tools

**Windows:**
- Flutter SDK with Windows support
- Visual Studio 2019+ (for C++ build tools)

**macOS:**
- Flutter SDK with macOS support
- Xcode Command Line Tools

**Linux:**
- Flutter SDK with Linux support
- CMake, ninja-build, clang

**All Platforms:**
- Flutter SDK 3.0+
- Dart SDK (bundled with Flutter)
- Appium 2.x
- appium-flutter-driver

## Success Criteria

**Package Creation:**
- `@wdio/flutter-service` package created in monorepo packages directory
- Package structure follows monorepo conventions (TypeScript, Vitest, Biome)
- 80%+ test coverage across all modules
- All linting and type checks pass
- README with comprehensive API documentation and examples

**Appium Integration Complete:**
- Appium server management working (start/stop, health checks)
- appium-flutter-driver validation implemented
- Capability configuration automatic for all platforms
- Flutter Driver connection established reliably
- Error handling with clear, actionable messages

**Binary Detection Working:**
- Auto-detects Flutter app binaries on all 5 platforms (iOS, Android, Windows, macOS, Linux)
- Handles debug, release, and profile build modes
- Parses pubspec.yaml for app metadata
- Provides helpful errors when binary not found (suggests build commands)
- Manual override via appPath configuration works

**Commands Implemented:**
- All element finding commands: byValueKey, byType, byText, bySemanticsLabel, byTooltip
- All interaction commands: tap, enterText, scroll, scrollUntilVisible, drag, longPress
- All waiting commands: waitForWidget, waitForAbsent, waitUntilNoTransientCallbacks
- All assertion commands: getText, isPresent, isVisible, getWidgetTree
- Commands registered on browser.flutter namespace
- Commands work across all platforms

**Multi-Platform Support:**
- iOS support validated (simulator + real device)
- Android support validated (emulator + real device)
- Windows support validated (x64 and arm64 builds)
- macOS support validated (Intel and Apple Silicon)
- Linux support validated (x64 and arm64 builds)
- Platform-specific capabilities configured correctly
- Platform detection working reliably

**Examples Complete:**
- Example app for Android with tests
- Example app for iOS with tests
- Example app for Windows with tests
- Example app for macOS with tests
- Example app for Linux with tests
- All example tests pass in CI
- Examples demonstrate all key features (login, navigation, lists, etc.)

**Quality Standards:**
- TypeScript strict mode enabled
- Dual ESM/CJS builds generated
- Declaration files (.d.ts) included
- Vitest tests with @vitest/coverage-v8
- Biome linting passes
- No circular dependencies
- Proper error handling throughout

**Documentation Complete:**
- README with quick start guide
- Installation instructions clear
- Platform-specific setup documented
- Configuration reference complete
- All commands documented with examples
- Migration guide from pure Appium
- Troubleshooting guide for common issues
- JSDoc comments on all public APIs

**CI/CD Integration:**
- GitHub Actions workflow configured
- Multi-platform testing matrix (Ubuntu, Windows, macOS)
- Mobile platform testing (Android emulator, iOS simulator)
- Desktop platform testing (Windows, macOS, Linux)
- Coverage reports generated and uploaded
- All platforms tested in parallel

**Ready for Item #5:**
- Foundation stable for widget testing integration
- Extension points documented for advanced features
- Performance benchmarks established
- No blocking bugs or critical issues

## Out of Scope

**NOT Included in This Specification:**

**Widget Testing Advanced Features (Item #5):**
- Screenshot comparison utilities
- Visual regression testing
- Advanced gestures beyond basic tap/scroll
- Platform-specific gesture recognition
- Widget tree diffing
- Performance profiling

**Custom Appium Plugins:**
- Not building custom Appium plugins
- Using existing appium-flutter-driver
- Not extending Appium server capabilities

**Flutter Driver Protocol Implementation:**
- Using existing Appium Flutter Driver
- Not implementing Dart VM Service Protocol from scratch
- Relying on production-ready tooling

**Mobile Device Farm Integration:**
- Not implementing BrowserStack/Sauce Labs integration
- May document patterns but not in-scope
- Future enhancement opportunity

**Advanced Platform Features:**
- Deep linking testing (potential Item #5)
- Push notification testing (potential Item #5)
- Background/foreground transitions (potential Item #5)
- Platform permissions testing (potential Item #5)

**Flutter Version Management:**
- Not managing Flutter SDK versions
- Assuming Flutter 3.0+ installed
- Users responsible for Flutter installation

**Build Tool Integration:**
- Not building Flutter apps automatically
- Assuming flutter build already run
- Binary detection only (not building)

**Rationale:** This specification focuses on core Flutter service architecture and Appium integration. Advanced features, device farms, and platform-specific testing patterns will be addressed in Item #5 (Flutter Service Widget Testing Integration).

## Risk Mitigation

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Appium Flutter Driver API changes | High | Medium | Pin driver version, monitor releases, test against multiple versions |
| Platform-specific Appium issues | Medium | Medium | Comprehensive platform testing in CI, fallback strategies |
| Flutter build output changes | Low | Low | Test against Flutter 3.0, 3.3, 3.7+, document supported versions |
| Mobile device configuration complexity | Medium | High | Excellent documentation, clear examples, helpful error messages |
| Desktop platform differences | Medium | Medium | Platform-specific configuration helpers, abstraction layer |
| Binary detection failures | Medium | Medium | Multiple path patterns, clear error messages with build commands |

### Mitigation Strategies

**Appium Driver Stability:**
- Pin appium-flutter-driver version in package.json
- Test against driver versions: 1.x, 2.x (when released)
- Monitor Appium Flutter Driver GitHub for breaking changes
- Provide driver version compatibility matrix in docs

**Platform Testing:**
- CI matrix testing all platforms
- Real device testing for mobile (at least Android emulator, iOS simulator)
- Desktop testing on Windows Server, Ubuntu, macOS runners
- Document platform-specific quirks and workarounds

**Binary Detection Reliability:**
- Test multiple Flutter versions (3.0, 3.3, 3.7, 3.10+)
- Test multiple build configurations (debug, release, profile)
- Test flavors and custom output directories
- Provide override mechanism (manual appPath)

**Error Messages:**
- Clear, actionable error text
- Suggest specific commands to fix issues
- Link to documentation for complex setups
- Include searched paths in binary not found errors

**Performance:**
- Benchmark Appium server startup time
- Cache binary detection results
- Reuse existing Appium server when possible
- Minimize overhead in command wrappers

**Backward Compatibility:**
- Semantic versioning strictly followed
- Deprecation warnings before breaking changes
- Migration guides for major versions
- Support multiple WebdriverIO versions (9.x)

