# Specification: Shared Core Utilities Package

> **⚠️ SPECIFICATION CANCELLED - January 2025**
>
> This specification was cancelled after implementation revealed it to be a premature abstraction (YAGNI violation).
>
> **Key Learnings:**
> - Base classes (BaseLauncher, BaseService) added 43 lines of boilerplate without reducing code
> - Abstractions were created from a single implementation (Electron) before validating reuse patterns
> - Concrete utilities (ConfigReader, BinaryDetector, WindowManager) remain unused by Electron service
> - The utilities are valuable for NEW services but retrofitting existing working code adds no value
>
> **Revised Approach:**
> - New services (Flutter, Tauri, Neutralino) should copy useful patterns from Electron service
> - Extract shared utilities only AFTER identifying actual duplication across 2-3 services
> - Follow "Rule of Three" - don't abstract until pattern appears in 3+ places
> - Revisit in Item #6 of roadmap after implementing Flutter and Neutralino services
>
> **Reference Implementation:**
> The extracted utilities (1,241 lines, 125 tests) remain in git history as reference for future extraction decisions.

---

## Goal

Create a framework-agnostic `@wdio/native-utils` package that extracts common functionality from the Electron service, enabling 50%+ code reuse across Flutter, Neutralino, and Tauri service implementations while maintaining clean separation between generic and framework-specific code.

## User Stories

- As a Flutter service developer, I want to reuse binary detection patterns so that I don't have to reimplement path resolution logic from scratch
- As a Neutralino service developer, I want to extend base launcher and service classes so that I can implement service lifecycle with consistent patterns
- As a Tauri service developer, I want to use shared configuration parsing utilities so that I can read tauri.conf.json with the same patterns used for other frameworks
- As a maintainer, I want framework-agnostic abstractions so that bug fixes in core utilities benefit all services
- As a developer, I want clear extension points so that I understand which code to customize vs. which to inherit

## Core Requirements

### Functional Requirements

#### FR1: Binary Path Resolution Framework
- Provide abstract BinaryDetector base class with extensible path generation
- Support multiple config file formats (JSON, YAML, TOML, JS/TS)
- Include platform utilities for path normalization and validation
- Enable framework-specific implementations to override path generation logic
- Support custom validation rules per framework

#### FR2: Service Lifecycle Abstractions
- Provide BaseLauncher class for onPrepare/onComplete hooks
- Provide BaseService class for before/after and command hooks
- Include configuration management helpers (merge, validate, defaults)
- Support command registration patterns for custom browser/element commands
- Enable capability configuration at service and worker levels

#### FR3: Window Management Abstractions
- Provide window handle management utilities (get, switch, list)
- Include window focus tracking with automatic switching logic
- Support multiremote instance management
- Enable per-instance window tracking

#### FR4: Configuration Parsing Utilities
- Support JSON5 (JSON with comments), YAML, TOML parsing
- Execute JavaScript/TypeScript config files via tsx
- Implement config file resolution with multiple filename patterns
- Support config inheritance (extends pattern)
- Provide schema validation with Zod
- Generate helpful error messages for invalid configs

#### FR5: Logging and Debugging Utilities
- Create scoped logger factory integrating with @wdio/logger
- Support structured logging with different log levels
- Provide debug mode based on environment variables
- Include performance timing utilities

#### FR6: Platform Detection Utilities
- Detect current platform (darwin, win32, linux)
- Provide platform display names (macOS, Windows, Linux)
- Detect CI environments
- Get Node.js runtime information
- Handle platform-specific path separators and line endings

#### FR7: Testing Utilities
- Provide mock helpers for command registration and browser objects
- Include common test fixtures for service testing
- Support custom matchers for configuration assertions

### Non-Functional Requirements

#### NFR1: Reusability
- Framework-agnostic design with no Electron-specific assumptions
- Clear extension points documented for each utility category
- Well-documented customization patterns with examples
- Base classes designed for inheritance not modification

#### NFR2: Performance
- No performance overhead compared to Electron service
- Lazy loading for optional utilities
- Minimal bundle size impact on consuming services
- Efficient config parsing and caching

#### NFR3: Maintainability
- Clear separation of concerns between utility categories
- Comprehensive JSDoc documentation for all public APIs
- Consistent coding patterns following project standards
- Easy to extend for new frameworks without modifying existing code

#### NFR4: Backward Compatibility
- Electron service continues to work after refactoring
- Semver versioning for the package
- Deprecation warnings for any breaking changes
- Migration guide for existing Electron service consumers

## Reusable Components

### Existing Code to Leverage

Based on the requirements document, the following Electron service patterns will be extracted:

**From `@wdio_electron-utils`:**
- Binary detection patterns (Forge, Builder, unpackaged)
- Platform-specific path handling
- Build tool config parsers (package.json, forge.config.js, electron-builder configs)
- Path validation and normalization utilities

**From `wdio-electron-service`:**
- Service lifecycle implementation (launcher and service classes)
- Configuration management patterns
- Window management logic
- Command registration patterns
- Logging integration with @wdio/logger

**Pattern Analysis:**
- Binary detection uses platform-specific extensions (.exe, .app, none)
- Config parsing supports multiple file formats and inheritance
- Service lifecycle follows WebdriverIO's standard hooks
- Window management tracks focus and handles multiremote

### New Components Required

**BinaryDetector Abstract Base Class:**
- Why: Needs to be framework-agnostic, Electron implementation is Electron-specific
- What: Abstract class with template method pattern for path generation

**ConfigReader Unified Interface:**
- Why: Must support different config formats per framework (tauri.conf.json, pubspec.yaml, neutralino.config.json)
- What: Pluggable reader system with format-specific parsers

**BaseLauncher/BaseService Classes:**
- Why: Extract common lifecycle management separate from Electron-specific logic
- What: Abstract base classes with hooks for framework customization

**WindowManager Abstraction:**
- Why: Window management patterns are similar but not identical across frameworks
- What: Base class with overridable methods for framework differences

## Technical Approach

### Package Structure

```
packages/@wdio/native-utils/
├── src/
│   ├── index.ts                     # Main exports
│   ├── binary-detection/
│   │   ├── BinaryDetector.ts        # Abstract base class
│   │   ├── PathValidator.ts         # Path validation utilities
│   │   ├── PlatformUtils.ts         # Platform-specific helpers
│   │   └── index.ts                 # Module exports
│   ├── service-lifecycle/
│   │   ├── BaseLauncher.ts          # Launcher base class
│   │   ├── BaseService.ts           # Service base class
│   │   ├── CommandRegistry.ts       # Command registration helpers
│   │   ├── ConfigManager.ts         # Configuration management
│   │   └── index.ts                 # Module exports
│   ├── window-management/
│   │   ├── WindowManager.ts         # Window handle management
│   │   ├── MultiremoteHelper.ts     # Multiremote utilities
│   │   └── index.ts                 # Module exports
│   ├── configuration/
│   │   ├── ConfigReader.ts          # Main reader interface
│   │   ├── parsers/
│   │   │   ├── JsonParser.ts        # JSON5 parser
│   │   │   ├── YamlParser.ts        # YAML parser
│   │   │   ├── TomlParser.ts        # TOML parser
│   │   │   └── TsParser.ts          # JS/TS executor via tsx
│   │   ├── ConfigMerger.ts          # Config inheritance
│   │   ├── ConfigValidator.ts       # Zod validation
│   │   └── index.ts                 # Module exports
│   ├── logging/
│   │   ├── LoggerFactory.ts         # Logger creation
│   │   ├── DebugUtils.ts            # Debug helpers
│   │   └── index.ts                 # Module exports
│   ├── platform/
│   │   ├── PlatformDetector.ts      # Platform detection
│   │   ├── EnvironmentUtils.ts      # Environment helpers
│   │   └── index.ts                 # Module exports
│   └── testing/
│       ├── MockHelpers.ts           # Test mocking utilities
│       ├── TestFixtures.ts          # Common fixtures
│       └── index.ts                 # Module exports
├── test/
│   ├── unit/                        # Mirrors src/ structure
│   │   ├── binary-detection/
│   │   ├── service-lifecycle/
│   │   ├── window-management/
│   │   ├── configuration/
│   │   ├── logging/
│   │   ├── platform/
│   │   └── testing/
│   └── integration/                 # Functional workflows
│       ├── binary-detection-workflow.spec.ts
│       ├── service-lifecycle-workflow.spec.ts
│       └── config-parsing-workflow.spec.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Architecture Patterns

**Binary Detection:**
- Template Method pattern: BinaryDetector defines algorithm, subclasses implement steps
- Strategy pattern: Different path generation strategies per framework
- Factory pattern: Create framework-specific detectors

**Service Lifecycle:**
- Template Method pattern: Base classes define hook flow, subclasses implement hooks
- Dependency Injection: Services receive configuration, capabilities, browser instances
- Command pattern: Command registration encapsulates browser command logic

**Configuration:**
- Strategy pattern: Different parsers for different formats
- Chain of Responsibility: Config resolution checks multiple file patterns
- Composite pattern: Config merging combines multiple sources

**Window Management:**
- Facade pattern: WindowManager simplifies complex window handle operations
- Observer pattern: Track window focus changes

### API Design Examples

**Binary Detection:**
```typescript
// Base class - framework-agnostic
abstract class BinaryDetector {
  abstract generatePossiblePaths(config: BuildToolConfig): string[]
  abstract getBuildToolConfig(projectRoot: string): Promise<BuildToolConfig>

  async detectBinaryPath(options: DetectionOptions): Promise<string> {
    // Template method - calls abstract methods
    const config = await this.getBuildToolConfig(options.projectRoot)
    const paths = this.generatePossiblePaths(config)
    return this.validateAndSelect(paths)
  }

  protected validateAndSelect(paths: string[]): string {
    // Shared validation logic
  }
}

// Framework-specific implementation
class ElectronBinaryDetector extends BinaryDetector {
  generatePossiblePaths(config: ElectronConfig): string[] {
    // Electron-specific path patterns
  }

  async getBuildToolConfig(projectRoot: string): Promise<ElectronConfig> {
    // Parse package.json, forge.config.js, etc.
  }
}

class FlutterBinaryDetector extends BinaryDetector {
  generatePossiblePaths(config: FlutterConfig): string[] {
    // Flutter build output patterns
  }

  async getBuildToolConfig(projectRoot: string): Promise<FlutterConfig> {
    // Parse pubspec.yaml
  }
}
```

**Service Lifecycle:**
```typescript
// Base launcher
abstract class BaseLauncher {
  protected options: ServiceOptions

  async onPrepare(config: Config, capabilities: Capabilities[]): Promise<void> {
    // Common setup
    this.validateOptions()
    await this.beforePrepare(config, capabilities)
    // Framework-specific hook
    await this.prepare(config, capabilities)
  }

  abstract prepare(config: Config, capabilities: Capabilities[]): Promise<void>

  protected async beforePrepare(config: Config, capabilities: Capabilities[]): Promise<void> {
    // Optional hook for setup
  }
}

// Framework implementation
class ElectronLauncher extends BaseLauncher {
  async prepare(config: Config, capabilities: Capabilities[]): Promise<void> {
    // Detect Electron binary
    // Start Chromedriver
    // Configure capabilities
  }
}

class TauriLauncher extends BaseLauncher {
  async prepare(config: Config, capabilities: Capabilities[]): Promise<void> {
    // Detect Tauri binary
    // Start tauri-driver
    // Configure capabilities
  }
}
```

**Configuration Reading:**
```typescript
// Reader interface
class ConfigReader<T> {
  constructor(private options: ConfigReaderOptions<T>) {}

  async read(projectRoot: string): Promise<T> {
    const configPath = await this.findConfigFile(projectRoot)
    const parser = this.selectParser(configPath)
    const rawConfig = await parser.parse(configPath)
    return this.validate(rawConfig)
  }

  private selectParser(filePath: string): ConfigParser {
    // Choose parser based on file extension
  }

  private validate(config: unknown): T {
    // Zod validation
  }
}

// Usage - Electron
const electronReader = new ConfigReader({
  filePatterns: ['forge.config.js', 'electron-builder.json'],
  schema: electronConfigSchema
})

// Usage - Tauri
const tauriReader = new ConfigReader({
  filePatterns: ['tauri.conf.json', '.taurirc.json'],
  schema: tauriConfigSchema
})
```

### Database

Not applicable - this is a testing utilities package with no database requirements.

### API

Not applicable - this package provides TypeScript/JavaScript APIs consumed by other packages, not HTTP APIs.

### Frontend

Not applicable - this is a Node.js package for test automation services.

### Testing Strategy

**Unit Tests (80%+ coverage required):**
- Test each utility class in isolation
- Mock external dependencies (filesystem, child processes)
- Test edge cases and error conditions
- Fast execution (milliseconds per test)

**Integration Tests:**
- Test complete workflows (binary detection end-to-end)
- Test config parsing with real config files
- Test service lifecycle with mock WebdriverIO interfaces
- Validate extension points work correctly

**Example Tests:**
```typescript
// Unit test example
describe('BinaryDetector', () => {
  it('should validate paths and return first valid one', () => {
    const detector = new TestBinaryDetector()
    const result = detector.validateAndSelect(['/invalid', '/valid/path'])
    expect(result).toBe('/valid/path')
  })
})

// Integration test example
describe('Config Reading Workflow', () => {
  it('should read and merge Electron configs', async () => {
    const reader = new ConfigReader({
      filePatterns: ['forge.config.js'],
      schema: electronSchema
    })
    const config = await reader.read('./test-fixtures/electron-project')
    expect(config.appName).toBe('Test App')
  })
})
```

## Extraction Strategy

### Phase 1: Analyze Electron Service Patterns (Week 1)

**Identify generalizable code:**
- Review `@wdio_electron-utils` for binary detection patterns
- Review `wdio-electron-service` for lifecycle patterns
- Document Electron-specific vs. framework-agnostic logic
- Create extraction plan with prioritized utilities

**Deliverables:**
- Analysis document listing all extractable patterns
- Categorization of code (100% reusable, needs adaptation, Electron-specific)
- API design sketches for base classes

### Phase 2: Design Framework-Agnostic Abstractions (Week 1-2)

**Create base interfaces and classes:**
- Design BinaryDetector abstract class
- Design BaseLauncher and BaseService classes
- Design ConfigReader with parser strategy
- Design WindowManager abstraction
- Write comprehensive TypeScript interfaces

**Validate extension points:**
- Sketch Flutter implementation using abstractions
- Sketch Neutralino implementation using abstractions
- Identify gaps in abstraction design
- Refine APIs based on findings

**Deliverables:**
- Complete TypeScript interfaces and abstract classes
- Extension point documentation
- Example usage patterns for each framework

### Phase 3: Create `@wdio/native-utils` Package (Week 2-3)

**Implement utilities:**
- Set up package structure with TypeScript, Vitest, Biome
- Implement binary detection framework
- Implement service lifecycle base classes
- Implement configuration parsing utilities
- Implement window management, logging, platform utilities
- Write unit tests achieving 80%+ coverage

**Quality gates:**
- All linting passes (Biome + ESLint)
- All type checks pass (TypeScript strict mode)
- 80%+ test coverage
- Integration tests for key workflows

**Deliverables:**
- Working `@wdio/native-utils` package
- 80%+ test coverage
- Comprehensive README with API documentation

### Phase 4: Refactor Electron Service (Week 3-4)

**Migrate Electron to use utilities:**
- Update `@wdio_electron-utils` to extend BinaryDetector
- Update `wdio-electron-service` launcher to extend BaseLauncher
- Update `wdio-electron-service` service to extend BaseService
- Replace duplicated code with utility imports
- Update tests to reflect new structure

**Validate no functionality lost:**
- Run all existing Electron service tests
- Verify all tests still pass
- Test Electron service with example apps (Forge, Builder, unpackaged)
- Validate multiremote and standalone modes still work

**Deliverables:**
- Refactored Electron service packages
- All Electron tests passing
- No duplicated code between Electron and native-utils

### Phase 5: Validate with Prototypes (Week 4)

**Create proof-of-concept implementations:**
- Create minimal Flutter service stub using utilities
- Demonstrate binary detection for Flutter builds
- Demonstrate service lifecycle extension
- Document learnings and API improvements

**Refine based on findings:**
- Adjust APIs based on real usage
- Add missing extension points
- Update documentation with real examples
- Prepare for Flutter/Neutralino/Tauri service implementations

**Deliverables:**
- Flutter service proof-of-concept
- Refined `@wdio/native-utils` APIs
- Real-world usage examples
- Validation report confirming readiness

## Dependencies

**Upstream (Required Complete):**
- Item #1: Monorepo Foundation - Provides pnpm workspaces, Turborepo, shared configs
- Item #2: Electron Service Migration - Source of patterns to extract

**Downstream (Will Use This Package):**
- Item #4: Flutter Service - Binary detection, service lifecycle, config parsing
- Item #6: Neutralino Service - Binary detection, service lifecycle, window management
- Item #8: Tauri Service - Binary detection, service lifecycle, config parsing

## Technology Stack

**Package Dependencies:**
- `webdriverio` ^9.0.0 (peer dependency)
- `@wdio/logger` (catalog version, peer dependency)
- `json5` - JSON with comments support
- `yaml` - YAML parsing
- `smol-toml` - TOML parsing
- `tsx` - TypeScript/JavaScript config file execution
- `zod` - Schema validation
- `debug` - Debug logging

**Dev Dependencies:**
- `vitest` ^3.2.0 - Testing framework
- `@vitest/coverage-v8` - Code coverage
- `typescript` ^5.9.0 - Language
- `@biomejs/biome` ^2.2.5 - Linting and formatting
- Standard monorepo dev dependencies from catalog

**Build Configuration:**
- Dual ESM/CJS builds via Rollup
- TypeScript strict mode enabled
- Declaration files (.d.ts) generated
- Proper package.json exports for both formats

## Extension Point Documentation

### For Binary Detection

**What to extend:**
```typescript
class YourFrameworkDetector extends BinaryDetector {
  // 1. Define how to find possible binary paths
  generatePossiblePaths(config: YourConfig): string[] {
    // Return array of possible binary locations
    // Use PlatformUtils for platform-specific paths
  }

  // 2. Define how to read build tool config
  async getBuildToolConfig(projectRoot: string): Promise<YourConfig> {
    // Use ConfigReader to parse your framework's config
    // Return typed config object
  }

  // 3. Optional: Custom validation
  protected validatePath(path: string): boolean {
    // Override if you need framework-specific validation
    return super.validatePath(path)
  }
}
```

**What you get for free:**
- Path validation logic
- Platform-specific path handling
- Error messages with suggestions
- Caching and performance optimizations

### For Service Lifecycle

**What to extend:**
```typescript
class YourFrameworkLauncher extends BaseLauncher {
  // Implement framework-specific preparation
  async prepare(config: Config, capabilities: Capabilities[]): Promise<void> {
    // 1. Detect binary using YourFrameworkDetector
    // 2. Start WebDriver (if needed)
    // 3. Configure capabilities
    // 4. Use this.mergeCapabilities() helper
  }

  // Optional: Cleanup
  async cleanup(): Promise<void> {
    // Stop WebDriver, clean up resources
  }
}

class YourFrameworkService extends BaseService {
  // Register custom commands
  async before(caps: Capabilities, specs: string[], browser: Browser): Promise<void> {
    await super.before(caps, specs, browser)

    // Register your framework's commands
    this.registerBrowserCommand('yourCommand', yourCommandImpl)
  }
}
```

**What you get for free:**
- Configuration merging and validation
- Command registration helpers
- Standard lifecycle hook execution
- Error handling patterns

### For Configuration

**What to extend:**
```typescript
// Define your config schema
const yourConfigSchema = z.object({
  appName: z.string(),
  buildDir: z.string(),
  // ... your fields
})

// Use ConfigReader
const reader = new ConfigReader({
  filePatterns: ['your.config.json', '.yourrc'],
  schema: yourConfigSchema,
  extends: true // Enable config inheritance
})

const config = await reader.read(projectRoot)
```

**What you get for free:**
- Multiple format support (JSON5, YAML, TOML, JS/TS)
- Config file resolution
- Inheritance support
- Validation with helpful error messages

## Out of Scope

**Electron-specific utilities:**
- CDP (Chrome DevTools Protocol) bridge
- Electron API mocking system
- Chromedriver version management (Electron-specific versioning)
- Electron Fuses handling

**Framework-specific implementations:**
- Flutter-specific binary detection logic
- Tauri command invocation patterns
- Neutralino WebSocket communication
- Flutter widget finding patterns

**Protocol bridges:**
- Dart VM Service Protocol integration (Flutter-specific)
- Tauri IPC implementation (Tauri-specific)
- Neutralino extensions system (Neutralino-specific)

**Platform-specific drivers:**
- Appium server management (Flutter)
- tauri-driver integration (Tauri)
- Platform WebDriver management (Neutralino)

**Rationale:** These are framework-specific concerns that belong in their respective service packages, not in shared utilities.

## Success Criteria

**Package Creation:**
- `@wdio/native-utils` published to monorepo packages
- Package structure follows monorepo conventions
- 80%+ test coverage achieved
- All linting and type checks pass
- README with comprehensive documentation

**Utilities Extracted:**
- Binary path resolution framework implemented and tested
- Service lifecycle base classes (BaseLauncher, BaseService) working
- Window management utilities extracted from Electron service
- Configuration parsing supports JSON5, YAML, TOML, JS/TS
- Platform detection utilities handle all platforms (Windows, macOS, Linux)
- Logging factory integrates with @wdio/logger

**Electron Service Refactored:**
- Electron service uses `@wdio/native-utils` for all common functionality
- No duplicated code between Electron and utilities
- All existing Electron service tests still pass
- Electron service documentation updated to reference utilities

**Validated for Reuse:**
- Clear extension points documented with examples
- Proof-of-concept implementation (Flutter stub) validates patterns
- Usage examples for each utility category
- API design validated with multiple framework patterns
- Ready for Items #4, #6, #8 (Flutter, Neutralino, Tauri)

**Quality Standards:**
- TypeScript strict mode enabled
- Dual ESM/CJS builds working
- Peer dependencies properly configured
- Vitest tests with @vitest/coverage-v8
- Biome linting passes
- No circular dependencies
