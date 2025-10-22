# Task Breakdown: Shared Core Utilities Package

## Overview
Total Tasks: 52 sub-tasks across 7 task groups
Estimated Timeline: 3-4 weeks (Q1 2026, Weeks 1-3)
Assigned roles: api-engineer, testing-engineer

## Task List

### Phase 1: Analysis and Design

#### Task Group 1: Analyze Electron Service Patterns
**Assigned implementer:** api-engineer
**Dependencies:** None (requires Item #2 Electron Service Migration complete)
**Estimated Effort:** Small (S) - 1-2 days

- [ ] 1.0 Complete pattern analysis for extraction
  - [ ] 1.1 Analyze binary detection patterns in `@wdio_electron-utils`
    - Review Forge binary detection logic
    - Review Builder binary detection logic
    - Review unpackaged binary detection logic
    - Document platform-specific path handling patterns
    - Identify framework-agnostic vs. Electron-specific code
    - Create categorization: 100% reusable, needs adaptation, Electron-only
  - [ ] 1.2 Analyze service lifecycle patterns in `wdio-electron-service`
    - Review launcher class (onPrepare/onComplete hooks)
    - Review service class (before/after/beforeCommand/afterCommand hooks)
    - Review configuration management patterns
    - Review capability merging logic
    - Document reusable lifecycle patterns
  - [ ] 1.3 Analyze configuration parsing patterns
    - Review package.json parsing
    - Review forge.config.js parsing
    - Review electron-builder config parsing
    - Identify config file resolution strategies
    - Document validation and error handling patterns
  - [ ] 1.4 Analyze window management patterns
    - Review window handle management
    - Review window focus tracking
    - Review multiremote support patterns
    - Document reusable abstractions
  - [ ] 1.5 Document extraction plan
    - Create prioritized list of utilities to extract
    - Identify extension points needed
    - Document API design constraints
    - Flag potential abstraction challenges
    - Link each utility to requirements (FR1-FR7)

**Acceptance Criteria:**
- Analysis document created listing all extractable patterns
- Code categorized as: 100% reusable / needs adaptation / framework-specific
- Extraction priorities documented with effort estimates
- Extension points identified for each utility category
- API design sketches created for base classes

---

#### Task Group 2: Design Framework-Agnostic Abstractions
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 1
**Estimated Effort:** Medium (M) - 2-3 days

- [ ] 2.0 Complete abstraction design
  - [ ] 2.1 Design BinaryDetector abstract base class
    - Create TypeScript interface with abstract methods
    - Design `detectBinaryPath()` template method
    - Design `generatePossiblePaths()` abstract method (framework-specific)
    - Design `getBuildToolConfig()` abstract method (framework-specific)
    - Design `validateAndSelect()` shared validation logic
    - Include PlatformUtils for platform-specific helpers
    - Document extension points for Electron, Flutter, Neutralino, Tauri
  - [ ] 2.2 Design BaseLauncher and BaseService classes
    - Create BaseLauncher with onPrepare/onComplete hooks
    - Design abstract `prepare()` method for framework customization
    - Create BaseService with before/after/command hooks
    - Design CommandRegistry helper for command registration
    - Design ConfigManager for configuration merging
    - Document lifecycle flow and extension points
  - [ ] 2.3 Design ConfigReader with parser strategy
    - Create ConfigReader interface
    - Design parser strategy (JSON5, YAML, TOML, JS/TS)
    - Design config file resolution logic (multiple patterns)
    - Design config inheritance (extends pattern)
    - Design Zod validation integration
    - Document usage for different framework configs
  - [ ] 2.4 Design WindowManager abstraction
    - Create WindowManager base class
    - Design window handle management methods
    - Design window focus tracking
    - Design multiremote helper utilities
    - Document framework customization points
  - [ ] 2.5 Design platform, logging, and testing utilities
    - PlatformDetector for platform detection
    - LoggerFactory for scoped logging with @wdio/logger
    - MockHelpers and TestFixtures for testing
    - Document APIs and usage patterns
  - [ ] 2.6 Validate abstractions with framework sketches
    - Sketch Electron implementation using abstractions
    - Sketch Flutter implementation using abstractions
    - Sketch Neutralino implementation using abstractions
    - Identify gaps in abstraction design
    - Refine APIs based on multi-framework validation
  - [ ] 2.7 Create comprehensive API documentation
    - Write TypeScript interfaces for all abstractions
    - Document extension points with code examples
    - Create usage guides for each utility category
    - Document design patterns used (Template Method, Strategy, etc.)

**Acceptance Criteria:**
- Complete TypeScript interfaces and abstract classes designed
- Extension points clearly documented with examples
- API validated against Electron, Flutter, Neutralino, Tauri patterns
- Design patterns documented (Template Method, Strategy, Factory, etc.)
- No Electron-specific assumptions in base abstractions

---

### Phase 2: Package Creation and Implementation

#### Task Group 3: Create `@wdio/native-utils` Package Structure
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 2
**Estimated Effort:** Small (S) - 1 day

- [ ] 3.0 Complete package setup
  - [ ] 3.1 Create package directory structure
    - Create `packages/@wdio/native-utils/` directory
    - Create `src/` with subdirectories: binary-detection, service-lifecycle, window-management, configuration, logging, platform, testing
    - Create `test/` with `unit/` and `integration/` subdirectories
    - Mirror `src/` structure in `test/unit/`
  - [ ] 3.2 Configure package.json
    - Set package name to `@wdio/native-utils`
    - Configure peer dependencies: `webdriverio` ^9.0.0, `@wdio/logger` (catalog)
    - Add dependencies: json5, yaml, smol-toml, tsx, zod, debug
    - Add dev dependencies: vitest, @vitest/coverage-v8, typescript, @biomejs/biome
    - Configure dual ESM/CJS exports
    - Add scripts: build, test, lint, typecheck
  - [ ] 3.3 Configure TypeScript
    - Create tsconfig.json with strict mode enabled
    - Configure declaration file generation
    - Configure module resolution
    - Set up dual ESM/CJS builds
  - [ ] 3.4 Configure Vitest
    - Create vitest.config.ts
    - Configure coverage with @vitest/coverage-v8
    - Set 80% coverage thresholds
    - Configure test patterns (*.spec.ts)
  - [ ] 3.5 Configure Biome linting
    - Create biome.json
    - Configure linting rules matching project standards
    - Configure formatter rules

**Acceptance Criteria:**
- Package directory structure created following monorepo conventions
- package.json configured with correct dependencies and exports
- TypeScript strict mode enabled with declaration generation
- Vitest configured with 80% coverage threshold
- Biome configured for linting and formatting

---

#### Task Group 4: Implement Core Utilities
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 3
**Estimated Effort:** Large (L) - 5-6 days

- [ ] 4.0 Complete core utilities implementation
  - [ ] 4.1 Implement binary detection framework
    - [ ] 4.1.1 Write 2-4 focused tests for BinaryDetector (FR1)
      - Test abstract class template method flow
      - Test path validation logic
      - Test platform-specific helpers
      - Mock filesystem for testing
    - [ ] 4.1.2 Implement BinaryDetector abstract base class
      - Implement `detectBinaryPath()` template method
      - Define abstract `generatePossiblePaths()` method
      - Define abstract `getBuildToolConfig()` method
      - Implement `validateAndSelect()` with path validation
    - [ ] 4.1.3 Implement PathValidator utilities
      - File existence validation
      - Execute permission checks
      - Platform-specific path validation
      - Error messages with suggestions
    - [ ] 4.1.4 Implement PlatformUtils helpers
      - `getPlatformBinaryExtension()` (.exe, .app, none)
      - `getPlatformArchitecture()` (x64, arm64)
      - `normalizePath()` for cross-platform paths
      - Path separator handling
    - [ ] 4.1.5 Verify binary detection tests pass
      - Run ONLY the 2-4 tests from 4.1.1
      - Verify template method pattern works correctly
      - Do NOT run entire test suite yet
  - [ ] 4.2 Implement service lifecycle abstractions
    - [ ] 4.2.1 Write 2-4 focused tests for lifecycle classes (FR2)
      - Test BaseLauncher hook execution order
      - Test BaseService hook execution order
      - Test configuration merging
      - Test command registration
    - [ ] 4.2.2 Implement BaseLauncher class
      - Implement `onPrepare()` hook with validation
      - Define abstract `prepare()` method
      - Implement `onComplete()` cleanup hook
      - Add `beforePrepare()` optional hook
    - [ ] 4.2.3 Implement BaseService class
      - Implement `before()` hook
      - Implement `after()` hook
      - Implement `beforeCommand()` and `afterCommand()` hooks
      - Support command registration pattern
    - [ ] 4.2.4 Implement ConfigManager
      - Configuration merging (service-level + capability-level)
      - Default configuration handling
      - Configuration validation
      - Type-safe configuration interfaces
    - [ ] 4.2.5 Implement CommandRegistry helpers
      - `registerBrowserCommand()` wrapper
      - `registerElementCommand()` wrapper
      - `overwriteCommand()` wrapper
      - Command registration error handling
    - [ ] 4.2.6 Verify service lifecycle tests pass
      - Run ONLY the 2-4 tests from 4.2.1
      - Verify hooks execute in correct order
      - Do NOT run entire test suite yet
  - [ ] 4.3 Implement configuration parsing utilities
    - [ ] 4.3.1 Write 2-4 focused tests for config parsing (FR4)
      - Test JSON5 parsing (with comments)
      - Test YAML parsing
      - Test config file resolution
      - Test Zod validation
    - [ ] 4.3.2 Implement ConfigReader main interface
      - `read()` method with file resolution
      - `findConfigFile()` with multiple patterns
      - `selectParser()` based on file extension
      - `validate()` with Zod integration
    - [ ] 4.3.3 Implement format-specific parsers
      - JsonParser for JSON5 (json5 package)
      - YamlParser (yaml package)
      - TomlParser (smol-toml package)
      - TsParser for JS/TS config files (tsx package)
    - [ ] 4.3.4 Implement ConfigMerger for inheritance
      - Support "extends" pattern
      - Deep merge configurations
      - Handle circular references
    - [ ] 4.3.5 Implement ConfigValidator with Zod
      - Schema validation
      - Type coercion
      - Helpful error messages
      - Required field checks
    - [ ] 4.3.6 Verify config parsing tests pass
      - Run ONLY the 2-4 tests from 4.3.1
      - Verify parsers work correctly
      - Do NOT run entire test suite yet
  - [ ] 4.4 Implement window management abstractions
    - [ ] 4.4.1 Write 2-3 focused tests for window management (FR3)
      - Test window handle retrieval
      - Test window switching
      - Test multiremote instance tracking
    - [ ] 4.4.2 Implement WindowManager base class
      - `getActiveWindowHandle()` method
      - `getAllWindowHandles()` method
      - `switchToWindowSafely()` with error handling
      - Window focus tracking logic
    - [ ] 4.4.3 Implement MultiremoteHelper utilities
      - Per-instance window tracking
      - Instance identification
      - Multiremote session management
    - [ ] 4.4.4 Verify window management tests pass
      - Run ONLY the 2-3 tests from 4.4.1
      - Verify window utilities work
      - Do NOT run entire test suite yet
  - [ ] 4.5 Implement logging utilities
    - [ ] 4.5.1 Write 2-3 focused tests for logging (FR5)
      - Test logger factory creation
      - Test scoped logging
      - Test debug mode activation
    - [ ] 4.5.2 Implement LoggerFactory
      - Create scoped loggers integrating with @wdio/logger
      - Support different log levels
      - Structured logging support
    - [ ] 4.5.3 Implement DebugUtils
      - Environment-based debug mode
      - Performance timing utilities
      - Diagnostic information helpers
    - [ ] 4.5.4 Verify logging tests pass
      - Run ONLY the 2-3 tests from 4.5.1
      - Do NOT run entire test suite yet
  - [ ] 4.6 Implement platform detection utilities
    - [ ] 4.6.1 Write 2-3 focused tests for platform detection (FR6)
      - Test platform detection
      - Test CI detection
      - Test platform display names
    - [ ] 4.6.2 Implement PlatformDetector
      - `getCurrentPlatform()` (darwin, win32, linux)
      - `getPlatformName()` (macOS, Windows, Linux)
      - `isCI()` - CI environment detection
      - `getNodeVersion()` - Runtime info
    - [ ] 4.6.3 Implement platform-specific helpers
      - Path separator handling
      - Line ending normalization
      - Environment variable access
    - [ ] 4.6.4 Verify platform detection tests pass
      - Run ONLY the 2-3 tests from 4.6.1
      - Do NOT run entire test suite yet
  - [ ] 4.7 Implement testing utilities
    - [ ] 4.7.1 Write 2-3 focused tests for testing utilities (FR7)
      - Test mock helpers
      - Test fixtures
      - Test custom matchers
    - [ ] 4.7.2 Implement MockHelpers
      - Mock command registration
      - Mock browser object creation
      - Mock WebdriverIO interfaces
    - [ ] 4.7.3 Implement TestFixtures
      - Common test fixtures for service testing
      - Sample configurations
      - Mock data generators
    - [ ] 4.7.4 Verify testing utilities tests pass
      - Run ONLY the 2-3 tests from 4.7.1
      - Do NOT run entire test suite yet

**Acceptance Criteria:**
- All utility modules implemented with TypeScript strict mode
- Each utility category has 2-4 focused unit tests
- Unit tests for each category pass independently
- Code follows project coding standards (Biome linting passes)
- JSDoc documentation added to all public APIs
- No circular dependencies between modules

---

### Phase 3: Testing and Validation

#### Task Group 5: Comprehensive Testing and Coverage
**Assigned implementer:** testing-engineer
**Dependencies:** Task Group 4
**Estimated Effort:** Medium (M) - 3-4 days

- [ ] 5.0 Complete testing and achieve 80%+ coverage
  - [ ] 5.1 Review existing unit tests from Task Group 4
    - Review 2-4 tests from binary detection (4.1.1)
    - Review 2-4 tests from service lifecycle (4.2.1)
    - Review 2-4 tests from config parsing (4.3.1)
    - Review 2-3 tests from window management (4.4.1)
    - Review 2-3 tests from logging (4.5.1)
    - Review 2-3 tests from platform detection (4.6.1)
    - Review 2-3 tests from testing utilities (4.7.1)
    - Total existing: approximately 16-24 unit tests
  - [ ] 5.2 Analyze test coverage gaps for utilities package
    - Run coverage report on existing tests
    - Identify critical gaps in coverage (<80%)
    - Focus on untested edge cases and error paths
    - Prioritize high-value test additions
    - Do NOT aim for 100% coverage, aim for 80%+
  - [ ] 5.3 Write up to 15 additional unit tests maximum
    - Fill critical coverage gaps identified in 5.2
    - Focus on error handling and edge cases
    - Test parameter validation
    - Test error message generation
    - Limit to maximum 15 new tests
  - [ ] 5.4 Write integration tests for workflows
    - Binary detection end-to-end workflow (1-2 tests)
    - Service lifecycle workflow (1-2 tests)
    - Config parsing workflow with real files (1-2 tests)
    - Window management workflow (1 test)
    - Maximum 5-7 integration tests total
  - [ ] 5.5 Run full test suite and verify coverage
    - Run all unit tests (approximately 31-39 tests)
    - Run all integration tests (5-7 tests)
    - Verify 80%+ coverage achieved
    - Verify all tests pass
    - Fix any failing tests
  - [ ] 5.6 Verify quality gates
    - TypeScript compilation with strict mode passes
    - Biome linting passes with no errors
    - All type checks pass
    - Coverage report shows 80%+ for all modules

**Acceptance Criteria:**
- 80%+ test coverage achieved across all utility modules
- Total tests: approximately 36-46 tests (31-39 unit + 5-7 integration)
- All tests pass successfully
- TypeScript strict mode compilation succeeds
- Biome linting passes
- No circular dependencies
- Test execution is fast (unit tests in milliseconds)

---

### Phase 4: Electron Service Refactoring

#### Task Group 6: Refactor Electron Service to Use Utilities
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 5
**Estimated Effort:** Medium (M) - 3-4 days

- [ ] 6.0 Complete Electron service refactoring
  - [ ] 6.1 Update `@wdio_electron-utils` to use binary detection framework
    - Create ElectronBinaryDetector extending BinaryDetector
    - Implement `generatePossiblePaths()` for Electron (Forge, Builder, unpackaged)
    - Implement `getBuildToolConfig()` for Electron configs
    - Replace existing binary detection with new implementation
    - Import PlatformUtils from @wdio/native-utils
    - Remove duplicated code
  - [ ] 6.2 Update `wdio-electron-service` launcher to use BaseLauncher
    - Create ElectronLauncher extending BaseLauncher
    - Implement `prepare()` method with Electron-specific logic
    - Use ConfigManager for configuration merging
    - Replace old launcher implementation
    - Remove duplicated lifecycle code
  - [ ] 6.3 Update `wdio-electron-service` service to use BaseService
    - Create ElectronService extending BaseService
    - Use CommandRegistry helpers for command registration
    - Replace old service implementation
    - Remove duplicated command registration code
  - [ ] 6.4 Update Electron service to use WindowManager
    - Import WindowManager from @wdio/native-utils
    - Replace manual window handling with WindowManager
    - Remove duplicated window management code
  - [ ] 6.5 Update Electron service to use ConfigReader
    - Use ConfigReader for package.json parsing
    - Use ConfigReader for forge.config.js parsing
    - Use ConfigReader for electron-builder configs
    - Remove duplicated config parsing code
  - [ ] 6.6 Update Electron service to use platform and logging utilities
    - Import PlatformDetector from @wdio/native-utils
    - Import LoggerFactory from @wdio/native-utils
    - Replace duplicated platform detection
    - Replace duplicated logging setup
  - [ ] 6.7 Update Electron service tests
    - Update tests to reflect new class structure
    - Use MockHelpers from @wdio/native-utils
    - Ensure all existing tests still pass
    - Update test assertions as needed
  - [ ] 6.8 Run Electron service test suite
    - Run complete Electron service test suite
    - Verify 100% of existing tests still pass
    - Fix any regressions
    - Validate multiremote mode works
    - Validate standalone mode works
  - [ ] 6.9 Update Electron service documentation
    - Update README to reference @wdio/native-utils
    - Document new class hierarchy
    - Add migration notes for consumers
    - Update API documentation

**Acceptance Criteria:**
- Electron service successfully uses @wdio/native-utils for all common functionality
- No duplicated code between Electron packages and native-utils
- All existing Electron service tests pass (100% pass rate)
- Electron service works with example apps (Forge, Builder, unpackaged)
- Multiremote and standalone modes validated
- Documentation updated with migration guide

---

### Phase 5: Validation with Prototypes

#### Task Group 7: Validate Utilities with Flutter Proof-of-Concept
**Assigned implementer:** api-engineer
**Dependencies:** Task Group 6
**Estimated Effort:** Small (S) - 2 days

- [ ] 7.0 Complete proof-of-concept validation
  - [ ] 7.1 Create minimal Flutter service stub package
    - Create `packages/wdio-flutter-service-stub/` directory
    - Set up package.json with @wdio/native-utils dependency
    - Create basic package structure
    - Note: This is a proof-of-concept, not a full implementation
  - [ ] 7.2 Implement FlutterBinaryDetector using utilities
    - Create FlutterBinaryDetector extending BinaryDetector
    - Implement `generatePossiblePaths()` for Flutter builds
    - Implement `getBuildToolConfig()` for pubspec.yaml
    - Test binary detection with mock Flutter project structure
    - Document learnings and API improvements needed
  - [ ] 7.3 Implement FlutterLauncher using BaseLauncher
    - Create FlutterLauncher extending BaseLauncher
    - Implement `prepare()` method (stub implementation)
    - Use ConfigManager for Flutter service config
    - Validate lifecycle hooks work correctly
    - Document any abstraction gaps found
  - [ ] 7.4 Implement FlutterService stub using BaseService
    - Create FlutterService extending BaseService
    - Use CommandRegistry for command registration stubs
    - Validate service hooks work correctly
    - Document extension point effectiveness
  - [ ] 7.5 Test Flutter stub with ConfigReader
    - Use ConfigReader to parse pubspec.yaml
    - Define Zod schema for Flutter config
    - Validate config parsing works for different format
    - Document any parser improvements needed
  - [ ] 7.6 Document findings and refine APIs
    - Document what worked well
    - Document API gaps or improvements needed
    - Create list of refinements for @wdio/native-utils
    - Update utility APIs based on real usage feedback
    - Create Flutter usage examples for documentation
  - [ ] 7.7 Write validation report
    - Confirm utilities work for non-Electron framework
    - Document abstraction effectiveness (50%+ code reuse achieved)
    - List any API changes needed before Flutter service implementation
    - Confirm readiness for Items #4, #6, #8 (Flutter, Neutralino, Tauri)

**Acceptance Criteria:**
- Flutter service proof-of-concept created demonstrating utility usage
- Binary detection works for Flutter build outputs
- Service lifecycle extensions work correctly
- Config parsing works for YAML format (pubspec.yaml)
- Findings documented with API refinement suggestions
- Validation report confirms 50%+ code reuse potential
- Real-world usage examples created for documentation
- Package ready for downstream service implementations

---

## Execution Order and Dependencies

### Recommended Implementation Sequence

**Week 1:**
1. Task Group 1: Analyze Electron Service Patterns (Days 1-2)
2. Task Group 2: Design Framework-Agnostic Abstractions (Days 2-4)
3. Task Group 3: Create Package Structure (Day 5)

**Week 2:**
4. Task Group 4: Implement Core Utilities (Days 1-5)

**Week 3:**
5. Task Group 5: Comprehensive Testing and Coverage (Days 1-3)
6. Task Group 6: Refactor Electron Service (Days 4-5)

**Week 4 (Optional/Buffer):**
7. Task Group 7: Validate with Flutter Proof-of-Concept (Days 1-2)

### Dependency Chain

```
Task Group 1 (Analysis)
    ↓
Task Group 2 (Design)
    ↓
Task Group 3 (Package Setup)
    ↓
Task Group 4 (Implementation)
    ↓
Task Group 5 (Testing)
    ↓
Task Group 6 (Electron Refactoring)
    ↓
Task Group 7 (Validation)
```

### Parallelization Opportunities

- **None in this spec** - Due to sequential nature of extraction and refactoring work
- Each task group depends on completion of previous group
- Within Task Group 4, sub-utilities can be implemented in parallel by same implementer

---

## Requirements Coverage

### Functional Requirements Mapping

- **FR1 (Binary Path Resolution)**: Task Group 4.1
- **FR2 (Service Lifecycle)**: Task Group 4.2
- **FR3 (Window Management)**: Task Group 4.4
- **FR4 (Configuration Parsing)**: Task Group 4.3
- **FR5 (Logging and Debugging)**: Task Group 4.5
- **FR6 (Platform Detection)**: Task Group 4.6
- **FR7 (Testing Utilities)**: Task Group 4.7

### Non-Functional Requirements Mapping

- **NFR1 (Reusability)**: Task Groups 2, 7 (abstraction design and validation)
- **NFR2 (Performance)**: Task Group 5 (testing validates no overhead)
- **NFR3 (Maintainability)**: Task Groups 2, 4 (design patterns, documentation)
- **NFR4 (Backward Compatibility)**: Task Group 6 (Electron refactoring validation)

---

## Effort Estimates Summary

| Task Group | Effort | Days | Implementer |
|------------|--------|------|-------------|
| 1. Analyze Patterns | S | 1-2 | api-engineer |
| 2. Design Abstractions | M | 2-3 | api-engineer |
| 3. Package Setup | S | 1 | api-engineer |
| 4. Implement Utilities | L | 5-6 | api-engineer |
| 5. Testing & Coverage | M | 3-4 | testing-engineer |
| 6. Electron Refactoring | M | 3-4 | api-engineer |
| 7. Flutter POC | S | 2 | api-engineer |
| **Total** | **~17-22 days** | **3-4 weeks** | |

---

## Success Metrics

### Package Creation
- [ ] `@wdio/native-utils` published to monorepo packages
- [ ] Package structure follows monorepo conventions
- [ ] 80%+ test coverage achieved (verified in Task Group 5)
- [ ] All linting and type checks pass
- [ ] README with comprehensive documentation

### Utilities Extracted
- [ ] Binary path resolution framework (Task Group 4.1)
- [ ] Service lifecycle base classes (Task Group 4.2)
- [ ] Window management utilities (Task Group 4.4)
- [ ] Configuration parsing (Task Group 4.3)
- [ ] Platform detection utilities (Task Group 4.6)
- [ ] Logging factory (Task Group 4.5)
- [ ] Testing utilities (Task Group 4.7)

### Electron Service Refactored
- [ ] Electron service uses `@wdio/native-utils` (Task Group 6)
- [ ] No duplicated code between packages
- [ ] All existing Electron tests pass (Task Group 6.8)
- [ ] Documentation updated (Task Group 6.9)

### Validated for Reuse
- [ ] Extension points documented with examples (Task Group 2.7)
- [ ] Flutter proof-of-concept validates patterns (Task Group 7)
- [ ] 50%+ code reuse potential confirmed (Task Group 7.7)
- [ ] Ready for Items #4, #6, #8 (Flutter, Neutralino, Tauri)

### Quality Standards
- [ ] TypeScript strict mode enabled
- [ ] Dual ESM/CJS builds working
- [ ] Peer dependencies properly configured
- [ ] Vitest tests with 80%+ coverage
- [ ] Biome linting passes
- [ ] No circular dependencies

---

## Risk Mitigation

### Risk: Over-abstraction
- **Mitigation**: Start with concrete Electron patterns, generalize incrementally (Task Group 1, 2)
- **Validation**: Flutter POC in Task Group 7 validates abstractions work

### Risk: Breaking Electron service
- **Mitigation**: Comprehensive test suite validation in Task Group 6.8
- **Validation**: 100% of existing Electron tests must pass

### Risk: API design mistakes
- **Mitigation**: Multi-framework validation in Task Group 2.6, real usage in Task Group 7
- **Validation**: Flutter POC demonstrates API effectiveness

### Risk: Insufficient test coverage
- **Mitigation**: 80%+ coverage requirement enforced in Task Group 5
- **Validation**: Coverage reports generated and verified

---

## Notes

### Testing Strategy Alignment
- Each implementation task group (4.1-4.7) writes 2-4 focused tests
- Testing-engineer reviews and adds maximum 15 additional tests
- Total expected tests: 36-46 tests (unit + integration)
- Aligns with project standard: focused testing during development, comprehensive coverage review

### Implementer Role Adaptation
- **api-engineer** assigned to utilities implementation (TypeScript/Node.js expertise)
- **testing-engineer** handles coverage analysis and gap filling
- No database or UI components in this spec (database-engineer, ui-designer not needed)

### Framework-Agnostic Design Priority
- All abstractions validated against 4 frameworks (Electron, Flutter, Neutralino, Tauri)
- Extension points documented for each framework
- No framework-specific assumptions in base classes
- Enables 50%+ code reuse goal (validated in Task Group 7)
