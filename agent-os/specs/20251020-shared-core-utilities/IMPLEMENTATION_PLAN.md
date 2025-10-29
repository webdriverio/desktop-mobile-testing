# Implementation Plan: Shared Core Utilities Package

**Status:** Ready to implement
**Target:** Item #2 - `@wdio/native-utils`
**Timeline:** 3-4 weeks
**Last Updated:** October 22, 2025

---

## 📋 Executive Summary

After analyzing the Electron service code, I've refined the implementation plan based on **actual patterns** found in the codebase. This plan prioritizes extraction of proven, reusable utilities while maintaining Electron service functionality.

### Key Findings from Code Analysis

**✅ Highly Reusable (95%+ framework-agnostic):**
1. **Configuration Reading** (`config/read.ts`) - Already framework-agnostic!
   - Supports JS/TS/JSON/JSON5/YAML/TOML
   - Uses tsx for TypeScript execution
   - Handles ESM/CJS compatibility
   - **Can be extracted almost as-is**

2. **Logger Factory** (`log.ts`) - Already generic!
   - Creates scoped loggers with @wdio/logger
   - Integrates debug package
   - Logger caching
   - **Needs minimal adaptation (just rename scope)**

3. **Binary Path Validation** (`binaryPath.ts`) - Well-structured!
   - Two-phase approach: generation → validation
   - Detailed error reporting
   - Platform-specific path handling
   - **Template Method pattern already in place**

4. **Window Management** (`window.ts`) - Clean abstractions!
   - Puppeteer session management
   - Active window tracking
   - Multiremote support
   - **Needs Protocol abstraction layer**

**⚠️ Needs Adaptation (70% reusable):**
1. **Service Lifecycle** (`launcher.ts`, `service.ts`)
   - Core patterns are generic (onPrepare/before/after hooks)
   - Electron-specific: Chromedriver management, CDP bridge init
   - **Extract: Base classes with abstract methods**

2. **Path Generation** (`binaryPath.ts - generateBinaryPaths`)
   - Platform utilities are generic
   - Path patterns are Electron-specific (Forge/Builder)
   - **Extract: PlatformUtils + Abstract path generation**

**❌ Electron-Specific (not extracting):**
- CDP Bridge (`bridge.ts`)
- API Mocking (`mock.ts`, `mockStore.ts`)
- Electron versioning (`versions.ts`, `fuses.ts`)
- AppArmor handling (`apparmor.ts`)
- Chromedriver capabilities (`capabilities.ts`)

---

## 🎯 Refined Strategy

### Strategy Change: Start with "Easy Wins"

**Original Plan:** Bottom-up (design abstractions → implement → refactor)
**Refined Plan:** Top-down with proven code (extract working code → adapt → validate)

**Why:** The config reader and logger are already framework-agnostic! We can extract them immediately with minimal changes, building confidence and momentum.

### Extraction Order (Prioritized by Ease + Value)

1. **Phase 1: Quick Wins** (2-3 days)
   - Extract config reader (95% done)
   - Extract logger factory (90% done)
   - Extract platform utilities
   - **Value:** Immediate reuse, builds confidence

2. **Phase 2: Core Abstractions** (4-5 days)
   - Extract binary detection framework
   - Design service lifecycle base classes
   - Extract path validation
   - **Value:** Establishes patterns for remaining work

3. **Phase 3: Advanced Utilities** (3-4 days)
   - Extract window management
   - Create testing utilities
   - Add missing helpers
   - **Value:** Completes the toolkit

4. **Phase 4: Refactor & Validate** (5-6 days)
   - Refactor Electron service
   - Run all Electron tests
   - Create Flutter POC
   - **Value:** Proves abstractions work

---

## 📦 Detailed Implementation Plan

### Phase 1: Quick Wins (Days 1-3)

#### Task 1.1: Set Up Package Structure (4 hours)
```bash
# Create package
packages/@wdio/native-utils/
├── src/
│   ├── configuration/
│   │   ├── ConfigReader.ts          # From config/read.ts
│   │   └── index.ts
│   ├── logging/
│   │   ├── LoggerFactory.ts         # From log.ts
│   │   └── index.ts
│   ├── platform/
│   │   ├── PlatformUtils.ts         # New
│   │   └── index.ts
│   └── index.ts
├── test/unit/
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

**Dependencies to add:**
```json
{
  "peerDependencies": {
    "@wdio/logger": "*",
    "webdriverio": "^9.0.0"
  },
  "dependencies": {
    "debug": "^4.3.7",
    "json5": "^2.2.3",
    "yaml": "^2.6.1",
    "smol-toml": "^1.3.1"
  },
  "devDependencies": {
    "esbuild": "^0.24.0",
    "tsx": "^4.19.2"
  }
}
```

**Acceptance:**
- Package builds with dual ESM/CJS
- All linting passes
- Ready for code extraction

---

#### Task 1.2: Extract ConfigReader (6 hours)

**Source:** `/packages/@wdio_electron-utils/src/config/read.ts`

**Changes needed:**
1. Rename `readConfig` → `ConfigReader.read()`
2. Make it a class to support options
3. Add file pattern resolution
4. Add schema validation (optional)

**API Design:**
```typescript
interface ConfigReaderOptions<T = unknown> {
  /**
   * File patterns to search for (e.g., ['forge.config.js', 'electron-builder.json'])
   */
  filePatterns: string[];

  /**
   * Optional Zod schema for validation
   */
  schema?: z.ZodSchema<T>;

  /**
   * Whether to support config inheritance (extends field)
   */
  extends?: boolean;
}

class ConfigReader<T = unknown> {
  constructor(private options: ConfigReaderOptions<T>) {}

  /**
   * Find and read config file from project directory
   */
  async read(projectRoot: string): Promise<T> {
    const configPath = await this.findConfigFile(projectRoot);
    const rawConfig = await this.readConfigFile(configPath);

    if (this.options.extends && rawConfig.extends) {
      return this.mergeWithParent(rawConfig, projectRoot);
    }

    return this.validate(rawConfig);
  }

  private async findConfigFile(projectRoot: string): Promise<string> {
    // Check each pattern in order
    for (const pattern of this.options.filePatterns) {
      const fullPath = path.join(projectRoot, pattern);
      if (await this.fileExists(fullPath)) {
        return fullPath;
      }
    }
    throw new Error(`No config file found. Looked for: ${this.options.filePatterns.join(', ')}`);
  }

  private async readConfigFile(configPath: string): Promise<unknown> {
    // Use existing readConfig logic from read.ts
    // Handles .js/.ts/.json/.json5/.yaml/.yml/.toml
  }

  private validate(config: unknown): T {
    if (!this.options.schema) {
      return config as T;
    }
    return this.options.schema.parse(config);
  }
}
```

**Tests:**
```typescript
describe('ConfigReader', () => {
  it('should read JSON config', async () => {
    const reader = new ConfigReader({ filePatterns: ['test.json'] });
    const config = await reader.read('./fixtures/json-config');
    expect(config).toEqual({ appName: 'Test' });
  });

  it('should read TypeScript config', async () => {
    const reader = new ConfigReader({ filePatterns: ['test.config.ts'] });
    const config = await reader.read('./fixtures/ts-config');
    expect(config).toBeDefined();
  });

  it('should validate with schema', async () => {
    const schema = z.object({ appName: z.string() });
    const reader = new ConfigReader({ filePatterns: ['test.json'], schema });
    await expect(reader.read('./fixtures/invalid-config')).rejects.toThrow();
  });

  it('should try multiple patterns', async () => {
    const reader = new ConfigReader({
      filePatterns: ['missing.json', 'existing.json']
    });
    const config = await reader.read('./fixtures/multi-pattern');
    expect(config).toBeDefined();
  });
});
```

**Acceptance:**
- ConfigReader class implemented
- All format tests pass (JS/TS/JSON/YAML/TOML)
- 80%+ coverage
- Can handle ESM/CJS mixed environments

---

#### Task 1.3: Extract LoggerFactory (4 hours)

**Source:** `/packages/@wdio_electron-utils/src/log.ts`

**Changes needed:**
1. Rename `createLogger` → `LoggerFactory.create()`
2. Make scope configurable (not hardcoded to 'wdio-electron-service')
3. Keep cache mechanism
4. Keep debug integration

**API Design:**
```typescript
interface LoggerOptions {
  /**
   * Scope for the logger (e.g., 'electron-service', 'flutter-service')
   */
  scope: string;

  /**
   * Optional area within scope (e.g., 'launcher', 'service')
   */
  area?: string;
}

class LoggerFactory {
  private static cache = new Map<string, Logger>();

  /**
   * Create or retrieve cached logger
   */
  static create(options: LoggerOptions): Logger {
    const key = `${options.scope}:${options.area || ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const debugInstance = debug(`${options.scope}${options.area ? `:${options.area}` : ''}`);
    const wdioLogger = logger(`${options.scope}${options.area ? `:${options.area}` : ''}`);

    // Wrap to integrate both
    const wrapped = this.wrapLogger(wdioLogger, debugInstance);
    this.cache.set(key, wrapped);
    return wrapped;
  }

  private static wrapLogger(wdioLogger: Logger, debugInstance: debug.Debugger): Logger {
    // Use existing wrapping logic from log.ts
  }
}

// Convenience function for Electron
export function createElectronLogger(area?: string) {
  return LoggerFactory.create({ scope: 'electron-service', area });
}
```

**Tests:**
```typescript
describe('LoggerFactory', () => {
  it('should create logger with scope', () => {
    const logger = LoggerFactory.create({ scope: 'test-service' });
    expect(logger).toBeDefined();
    expect(logger.info).toBeInstanceOf(Function);
  });

  it('should cache loggers', () => {
    const logger1 = LoggerFactory.create({ scope: 'test', area: 'area1' });
    const logger2 = LoggerFactory.create({ scope: 'test', area: 'area1' });
    expect(logger1).toBe(logger2);
  });

  it('should create different loggers for different scopes', () => {
    const logger1 = LoggerFactory.create({ scope: 'service1' });
    const logger2 = LoggerFactory.create({ scope: 'service2' });
    expect(logger1).not.toBe(logger2);
  });
});
```

**Acceptance:**
- LoggerFactory implemented
- Logger caching works
- Integration with @wdio/logger and debug
- 80%+ coverage

---

#### Task 1.4: Extract PlatformUtils (6 hours)

**Source:** Parts of `binaryPath.ts` + new utilities

**API Design:**
```typescript
export class PlatformUtils {
  /**
   * Get current platform
   */
  static getPlatform(): 'darwin' | 'win32' | 'linux' {
    return process.platform as 'darwin' | 'win32' | 'linux';
  }

  /**
   * Get display name for platform
   */
  static getPlatformDisplayName(): 'macOS' | 'Windows' | 'Linux' {
    const map = {
      darwin: 'macOS' as const,
      win32: 'Windows' as const,
      linux: 'Linux' as const,
    };
    return map[this.getPlatform()];
  }

  /**
   * Get binary extension for platform
   */
  static getBinaryExtension(): '.exe' | '.app' | '' {
    const platform = this.getPlatform();
    return platform === 'win32' ? '.exe' : platform === 'darwin' ? '.app' : '';
  }

  /**
   * Get platform architecture
   */
  static getArchitecture(): string {
    return process.arch;
  }

  /**
   * Normalize path for platform
   */
  static normalizePath(inputPath: string): string {
    return path.normalize(inputPath);
  }

  /**
   * Check if running in CI
   */
  static isCI(): boolean {
    return Boolean(process.env.CI);
  }

  /**
   * Get Node version
   */
  static getNodeVersion(): string {
    return process.version;
  }

  /**
   * Sanitize app name for path (Linux spaces → kebab-case)
   */
  static sanitizeAppNameForPath(appName: string): string {
    const platform = this.getPlatform();
    return platform === 'linux' ? appName.toLowerCase().replace(/ /g, '-') : appName;
  }
}
```

**Tests:**
```typescript
describe('PlatformUtils', () => {
  it('should get platform', () => {
    const platform = PlatformUtils.getPlatform();
    expect(['darwin', 'win32', 'linux']).toContain(platform);
  });

  it('should get binary extension', () => {
    const ext = PlatformUtils.getBinaryExtension();
    if (process.platform === 'win32') expect(ext).toBe('.exe');
    if (process.platform === 'darwin') expect(ext).toBe('.app');
    if (process.platform === 'linux') expect(ext).toBe('');
  });

  it('should sanitize app name for Linux', () => {
    const result = PlatformUtils.sanitizeAppNameForPath('My App Name');
    // Result depends on platform, but should be consistent
    expect(result).toBeDefined();
  });
});
```

**Acceptance:**
- PlatformUtils implemented
- All platform detection methods work
- Cross-platform tests pass
- 80%+ coverage

---

### Phase 2: Core Abstractions (Days 4-8)

#### Task 2.1: Extract Binary Detection Framework (12 hours)

**Source:** `binaryPath.ts` (phases 1 & 2)

**Goal:** Create abstract base class that Electron (and other frameworks) can extend.

**Key Insight from Code:**
The Electron implementation already uses a **two-phase approach**:
1. **Phase 1:** `generateBinaryPaths()` - Framework-specific
2. **Phase 2:** `validateBinaryPaths()` - Generic

This is perfect for Template Method pattern!

**API Design:**
```typescript
// Type definitions
export interface BinaryDetectionOptions {
  projectRoot: string;
  electronVersion?: string; // Or frameworkVersion
}

export interface PathGenerationResult {
  success: boolean;
  paths: string[];
  errors: PathGenerationError[];
}

export interface PathValidationResult {
  success: boolean;
  validPath?: string;
  attempts: PathValidationAttempt[];
}

export interface BinaryDetectionResult {
  success: boolean;
  binaryPath?: string;
  pathGeneration: PathGenerationResult;
  pathValidation: PathValidationResult;
}

// Abstract base class
export abstract class BinaryDetector {
  /**
   * Main entry point - Template Method pattern
   */
  async detectBinaryPath(options: BinaryDetectionOptions): Promise<BinaryDetectionResult> {
    // Phase 1: Generate possible paths (framework-specific)
    const pathGeneration = await this.generatePossiblePaths(options);

    // Phase 2: Validate paths (generic)
    let pathValidation: PathValidationResult;
    if (!pathGeneration.success || pathGeneration.paths.length === 0) {
      pathValidation = {
        success: false,
        validPath: undefined,
        attempts: [],
      };
    } else {
      pathValidation = await this.validateBinaryPaths(pathGeneration.paths);
    }

    return {
      success: pathGeneration.success && pathValidation.success,
      binaryPath: pathValidation.validPath,
      pathGeneration,
      pathValidation,
    };
  }

  /**
   * Abstract: Generate possible binary paths
   * Framework-specific implementation
   */
  protected abstract generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult>;

  /**
   * Concrete: Validate generated paths
   * Generic implementation from Electron's validateBinaryPaths()
   */
  protected async validateBinaryPaths(paths: string[]): Promise<PathValidationResult> {
    // Use existing validation logic from selectExecutable.ts
    const attempts: PathValidationAttempt[] = [];

    for (const path of paths) {
      try {
        await fs.access(path, fs.constants.F_OK | fs.constants.X_OK);
        // Path exists and is executable
        return {
          success: true,
          validPath: path,
          attempts,
        };
      } catch (error) {
        attempts.push({
          path,
          error: this.categorizeError(error),
        });
      }
    }

    return {
      success: false,
      validPath: undefined,
      attempts,
    };
  }

  /**
   * Helper: Categorize validation errors
   */
  private categorizeError(error: unknown): PathValidationError {
    // Use logic from Electron service
  }
}

// Electron implementation example
export class ElectronBinaryDetector extends BinaryDetector {
  protected async generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult> {
    // Use existing generateBinaryPaths() logic from binaryPath.ts
    // This is Electron-specific (Forge/Builder detection)
  }
}

// Future: Flutter implementation
export class FlutterBinaryDetector extends BinaryDetector {
  protected async generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult> {
    // Flutter-specific: look in build/linux/, build/macos/, build/windows/
    // Parse pubspec.yaml for app name
    // Return Flutter-specific paths
  }
}
```

**Tests:**
```typescript
describe('BinaryDetector', () => {
  // Test with a mock implementation
  class TestDetector extends BinaryDetector {
    constructor(private mockPaths: string[]) {
      super();
    }

    protected async generatePossiblePaths(): Promise<PathGenerationResult> {
      return {
        success: true,
        paths: this.mockPaths,
        errors: [],
      };
    }
  }

  it('should validate paths and return first valid one', async () => {
    const detector = new TestDetector(['/invalid', '/valid/path']);
    // Mock filesystem
    const result = await detector.detectBinaryPath({ projectRoot: '/test' });
    expect(result.success).toBe(true);
  });

  it('should return errors when no valid path found', async () => {
    const detector = new TestDetector(['/invalid1', '/invalid2']);
    const result = await detector.detectBinaryPath({ projectRoot: '/test' });
    expect(result.success).toBe(false);
    expect(result.pathValidation.attempts).toHaveLength(2);
  });
});
```

**Acceptance:**
- BinaryDetector abstract class works
- Template Method pattern validated
- Path validation logic extracted
- Tests with mock detector pass
- 80%+ coverage

---

#### Task 2.2: Design Service Lifecycle Base Classes (12 hours)

**Source:** `launcher.ts` and `service.ts`

**Challenge:** Extract reusable patterns while leaving Electron-specific logic in Electron service.

**Electron-specific (stays in Electron):**
- Chromedriver version detection
- CDP bridge initialization
- AppArmor workaround
- Electron capability configuration

**Generic (extract to base classes):**
- onPrepare/onComplete hook structure
- before/after/beforeCommand/afterCommand hooks
- Configuration merging
- Port allocation patterns
- Command registration

**API Design:**

```typescript
// Base Launcher
export abstract class BaseLauncher implements Services.ServiceInstance {
  protected options: ServiceOptions;
  protected projectRoot: string;

  constructor(options: ServiceOptions, config: Options.Testrunner) {
    this.options = options;
    this.projectRoot = options.rootDir || config.rootDir || process.cwd();
  }

  /**
   * WebdriverIO onPrepare hook - calls prepare()
   */
  async onPrepare(config: Options.Testrunner, capabilities: Capabilities[]): Promise<void> {
    // Normalize capabilities (handle multiremote)
    const caps = this.normalizeCapabilities(capabilities);

    // Validate service configuration
    this.validateOptions();

    // Call framework-specific preparation
    await this.prepare(config, caps);
  }

  /**
   * Abstract: Framework-specific preparation
   * Implement: binary detection, driver startup, capability configuration
   */
  protected abstract prepare(config: Options.Testrunner, capabilities: Capabilities[]): Promise<void>;

  /**
   * Normalize capabilities array (handle multiremote)
   */
  protected normalizeCapabilities(capabilities: unknown): Capabilities[] {
    // Extract from Electron launcher.ts
  }

  /**
   * Optional: Cleanup hook
   */
  async onComplete(): Promise<void> {
    await this.cleanup();
  }

  protected async cleanup(): Promise<void> {
    // Override if needed
  }

  /**
   * Helper: Validate service options
   */
  protected validateOptions(): void {
    // Can be overridden
  }
}

// Base Service
export abstract class BaseService implements Services.ServiceInstance {
  protected browser?: WebdriverIO.Browser;
  protected options: ServiceOptions;

  constructor(options: ServiceOptions, capabilities: Capabilities) {
    this.options = options;
  }

  /**
   * WebdriverIO before hook
   */
  async before(
    capabilities: Capabilities,
    specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    this.browser = browser as WebdriverIO.Browser;

    // Framework-specific initialization
    await this.initialize(capabilities, specs, browser);

    // Register commands
    await this.registerCommands();
  }

  /**
   * Abstract: Framework-specific initialization
   */
  protected abstract initialize(
    capabilities: Capabilities,
    specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void>;

  /**
   * Abstract: Register framework-specific commands
   */
  protected abstract registerCommands(): Promise<void>;

  /**
   * Helper: Register browser command
   */
  protected registerBrowserCommand(name: string, fn: (...args: any[]) => any): void {
    if (!this.browser) return;
    this.browser.addCommand(name, fn);
  }

  /**
   * Helper: Override browser command
   */
  protected overwriteBrowserCommand(name: string, fn: (...args: any[]) => any): void {
    if (!this.browser) return;
    this.browser.overwriteCommand(name, fn);
  }

  /**
   * Optional: Cleanup
   */
  async after(): Promise<void> {
    await this.cleanup();
  }

  protected async cleanup(): Promise<void> {
    // Override if needed
  }
}
```

**Electron Implementation Example:**
```typescript
// In Electron service
export class ElectronLauncher extends BaseLauncher {
  protected async prepare(config: Options.Testrunner, capabilities: Capabilities[]): Promise<void> {
    // 1. Detect Electron version
    const electronVersion = await getElectronVersion();

    // 2. Get Chromium version
    const chromiumVersion = await getChromiumVersion(electronVersion);

    // 3. Detect binary
    const detector = new ElectronBinaryDetector();
    const result = await detector.detectBinaryPath({ projectRoot: this.projectRoot });

    // 4. Configure capabilities (Electron-specific)
    // ... existing Electron logic

    // 5. Apply AppArmor workaround (Electron-specific)
    // ... existing Electron logic
  }
}

export class ElectronService extends BaseService {
  private cdpBridge?: ElectronCdpBridge;

  protected async initialize(caps, specs, browser): Promise<void> {
    // Initialize CDP bridge (Electron-specific)
    this.cdpBridge = await initCdpBridge(this.options, caps);
  }

  protected async registerCommands(): Promise<void> {
    // Register Electron API
    this.registerBrowserCommand('electron', this.getElectronAPI());

    // Register mock commands
    this.registerBrowserCommand('mock', mockCommand);
    // ... etc
  }
}
```

**Tests:**
```typescript
describe('BaseLauncher', () => {
  class TestLauncher extends BaseLauncher {
    prepareCalled = false;

    protected async prepare() {
      this.prepareCalled = true;
    }
  }

  it('should call prepare during onPrepare', async () => {
    const launcher = new TestLauncher({}, { rootDir: '/test' });
    await launcher.onPrepare({}, []);
    expect(launcher.prepareCalled).toBe(true);
  });
});

describe('BaseService', () => {
  class TestService extends BaseService {
    initializeCalled = false;

    protected async initialize() {
      this.initializeCalled = true;
    }

    protected async registerCommands() {
      this.registerBrowserCommand('testCommand', () => 'test');
    }
  }

  it('should call initialize during before', async () => {
    const service = new TestService({}, {});
    const mockBrowser = { addCommand: vi.fn() };
    await service.before({}, [], mockBrowser as any);
    expect(service.initializeCalled).toBe(true);
  });
});
```

**Acceptance:**
- BaseLauncher and BaseService implemented
- Electron-specific logic stays in Electron packages
- Generic hooks extracted
- Command registration helpers work
- Tests pass with mock implementations
- 80%+ coverage

---

### Phase 3: Advanced Utilities (Days 9-12)

#### Task 3.1: Extract Window Management (8 hours)

**Source:** `window.ts`

**Challenge:** Electron uses Puppeteer for window management. Need to abstract this.

**Solution:** Create protocol-agnostic interface, Electron provides Puppeteer implementation.

**API Design:**
```typescript
// Protocol-agnostic interface
export interface WindowProtocol {
  getWindowHandles(): Promise<string[]>;
  switchToWindow(handle: string): Promise<void>;
}

// Window manager
export class WindowManager {
  private sessionCache = new Map<string, any>();

  constructor(private protocol: WindowProtocol) {}

  async getActiveWindowHandle(currentHandle?: string): Promise<string | undefined> {
    const handles = await this.protocol.getWindowHandles();

    if (handles.length === 0) {
      return undefined;
    }

    if (currentHandle && handles.includes(currentHandle)) {
      return currentHandle;
    }

    return handles[0];
  }

  async ensureActiveWindowFocus(
    browser: WebdriverIO.Browser,
    currentHandle?: string,
  ): Promise<void> {
    const activeHandle = await this.getActiveWindowHandle(currentHandle);

    if (activeHandle && activeHandle !== currentHandle) {
      await this.protocol.switchToWindow(activeHandle);
    }
  }
}

// Electron implementation (stays in Electron service)
export class PuppeteerWindowProtocol implements WindowProtocol {
  constructor(private puppeteer: PuppeteerBrowser) {}

  async getWindowHandles(): Promise<string[]> {
    return this.puppeteer
      .targets()
      .filter((target) => target.type() === 'page')
      .map((target) => (target as any)._targetId);
  }

  async switchToWindow(handle: string): Promise<void> {
    // Puppeteer-specific implementation
  }
}
```

**Tests:**
```typescript
describe('WindowManager', () => {
  class MockProtocol implements WindowProtocol {
    constructor(private handles: string[]) {}

    async getWindowHandles() {
      return this.handles;
    }

    async switchToWindow(handle: string) {
      // Mock implementation
    }
  }

  it('should return first handle when no current handle', async () => {
    const protocol = new MockProtocol(['handle1', 'handle2']);
    const manager = new WindowManager(protocol);
    const handle = await manager.getActiveWindowHandle();
    expect(handle).toBe('handle1');
  });

  it('should keep current handle if still valid', async () => {
    const protocol = new MockProtocol(['handle1', 'handle2']);
    const manager = new WindowManager(protocol);
    const handle = await manager.getActiveWindowHandle('handle2');
    expect(handle).toBe('handle2');
  });
});
```

**Acceptance:**
- WindowManager abstracted
- Protocol interface defined
- Electron can provide Puppeteer implementation
- Tests pass with mock protocol
- 80%+ coverage

---

#### Task 3.2: Create Testing Utilities (4 hours)

**API Design:**
```typescript
// Mock browser helper
export function createMockBrowser(overrides?: Partial<WebdriverIO.Browser>): WebdriverIO.Browser {
  return {
    sessionId: 'test-session',
    addCommand: vi.fn(),
    overwriteCommand: vi.fn(),
    ...overrides,
  } as any;
}

// Mock capabilities
export function createMockCapabilities(overrides?: Partial<Capabilities>): Capabilities {
  return {
    browserName: 'test-browser',
    ...overrides,
  };
}

// Common test fixtures
export const testFixtures = {
  projectRoot: path.join(__dirname, '../../../fixtures/test-project'),
  validBinaryPath: '/valid/binary/path',
  invalidBinaryPath: '/invalid/binary/path',
};
```

**Acceptance:**
- Testing utilities created
- Mock helpers working
- Documentation with examples
- Used in other utility tests

---

### Phase 4: Refactor & Validate (Days 13-18)

#### Task 4.1: Refactor Electron Service to Use Utilities (16 hours)

**Changes to Electron packages:**

1. **`@wdio/electron-utils`:**
   ```typescript
   // BEFORE: Own config reading
   import { readConfig } from './config/read.js';

   // AFTER: Use shared utility
   import { ConfigReader } from '@wdio/native-utils';

   const reader = new ConfigReader({
     filePatterns: ['forge.config.js', 'forge.config.ts', /* ... */],
   });
   ```

2. **`@wdio/electron-utils`:**
   ```typescript
   // BEFORE: Own logger
   import { createLogger } from './log.js';

   // AFTER: Use shared factory
   import { createElectronLogger } from '@wdio/native-utils';
   ```

3. **`@wdio/electron-service` launcher:**
   ```typescript
   // BEFORE: Direct implementation
   export default class ElectronLaunchService implements Services.ServiceInstance {
     async onPrepare() { /* ... */ }
   }

   // AFTER: Extend base class
   import { BaseLauncher } from '@wdio/native-utils';

   export default class ElectronLauncher extends BaseLauncher {
     protected async prepare(config, caps) {
       // Electron-specific logic only
     }
   }
   ```

4. **`@wdio/electron-service` service:**
   ```typescript
   // BEFORE: Direct implementation
   export default class ElectronWorkerService implements Services.ServiceInstance {
     async before() { /* ... */ }
   }

   // AFTER: Extend base class
   import { BaseService } from '@wdio/native-utils';

   export default class ElectronService extends BaseService {
     protected async initialize(caps, specs, browser) {
       // CDP bridge, etc.
     }

     protected async registerCommands() {
       // Electron commands
     }
   }
   ```

**Validation:**
- Run full Electron test suite
- All E2E tests pass
- All unit tests pass
- All package tests pass
- No duplicated code remains

**Acceptance:**
- Electron service fully refactored
- Uses @wdio/native-utils for all generic functionality
- All tests still pass
- Code duplication eliminated

---

#### Task 4.2: Create Flutter POC (8 hours)

**Goal:** Validate abstractions work for a different framework.

**Implementation:**
```typescript
// packages/@wdio/flutter-service-poc/src/detector.ts
import { BinaryDetector, type BinaryDetectionOptions, type PathGenerationResult } from '@wdio/native-utils';

export class FlutterBinaryDetector extends BinaryDetector {
  protected async generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult> {
    // 1. Read pubspec.yaml to get app name
    const reader = new ConfigReader({ filePatterns: ['pubspec.yaml'] });
    const config = await reader.read(options.projectRoot);
    const appName = config.name;

    // 2. Generate Flutter build paths
    const platform = PlatformUtils.getPlatform();
    const paths: string[] = [];

    switch (platform) {
      case 'linux':
        paths.push(path.join(options.projectRoot, 'build/linux/x64/release/bundle', appName));
        break;
      case 'darwin':
        paths.push(path.join(options.projectRoot, 'build/macos/Build/Products/Release', `${appName}.app`));
        break;
      case 'win32':
        paths.push(path.join(options.projectRoot, 'build/windows/x64/runner/Release', `${appName}.exe`));
        break;
    }

    return {
      success: true,
      paths,
      errors: [],
    };
  }
}

// packages/@wdio/flutter-service-poc/src/launcher.ts
import { BaseLauncher } from '@wdio/native-utils';

export class FlutterLauncher extends BaseLauncher {
  protected async prepare(config, capabilities) {
    // 1. Detect Flutter binary
    const detector = new FlutterBinaryDetector();
    const result = await detector.detectBinaryPath({ projectRoot: this.projectRoot });

    if (!result.success) {
      throw new Error('Flutter app not found');
    }

    // 2. Start Appium (Flutter uses Appium)
    // ... Flutter-specific logic

    // 3. Configure capabilities
    // ... Flutter-specific capabilities
  }
}
```

**Acceptance:**
- Flutter POC can detect binary
- Flutter POC extends base classes successfully
- Demonstrates utility reuse
- Documents any API improvements needed

---

## 📊 Success Metrics

**Code Quality:**
- ✅ 80%+ test coverage on all utilities
- ✅ TypeScript strict mode passing
- ✅ Biome linting passing
- ✅ No circular dependencies

**Functionality:**
- ✅ All Electron tests still pass after refactor
- ✅ ConfigReader supports all formats (JS/TS/JSON/YAML/TOML)
- ✅ LoggerFactory integrates with @wdio/logger
- ✅ BinaryDetector template method works
- ✅ Base classes extensible by other frameworks

**Reusability:**
- ✅ Flutter POC validates abstractions
- ✅ Extension points documented
- ✅ Usage examples for each utility
- ✅ Ready for Neutralino and Tauri services

---

## 🔄 Risk Mitigation

**Risk: Breaking Electron service during refactor**
- **Mitigation:** Refactor incrementally, run tests after each change
- **Validation:** CI runs full test suite on every commit

**Risk: Over-abstraction (utilities too generic)**
- **Mitigation:** Extract proven patterns, validate with Flutter POC
- **Validation:** Flutter POC must successfully use utilities

**Risk: Under-abstraction (utilities too Electron-specific)**
- **Mitigation:** Review each utility against Flutter/Tauri/Neutralino needs
- **Validation:** Document why each abstraction is generic

**Risk: Timeline overrun**
- **Mitigation:** Prioritize Phase 1 (quick wins) to build momentum
- **Validation:** Track progress daily, adjust scope if needed

---

## 📝 Next Steps

1. **Review this plan** - Get approval on refined approach
2. **Start Phase 1** - Begin with ConfigReader extraction (easy win)
3. **Daily check-ins** - Track progress, adjust as needed
4. **Weekly demos** - Show working utilities + Electron integration

---

## 🎯 Conclusion

This refined plan takes advantage of the **already-framework-agnostic code** in the Electron service (ConfigReader, LoggerFactory) while carefully extracting **proven patterns** (binary detection, service lifecycle) into reusable abstractions.

By starting with "easy wins" (Phase 1), we build momentum and confidence before tackling more complex abstractions (Phase 2-3). The Flutter POC (Phase 4) validates that our abstractions are truly reusable.

**Ready to proceed to implementation!** 🚀

