# Product Roadmap

1. [ ] Monorepo Foundation with Electron Service — Establish monorepo workspace (pnpm, Turborepo, shared configs) while migrating Electron service from standalone repository as the first package. Ensure all existing features work (binary detection, main process access via CDP, API mocking, window management), maintain 80%+ test coverage. Set up CI/CD pipeline based on Electron's actual testing requirements (package tests, E2E tests, multi-platform matrix). Establish package structure conventions and build patterns for future services. `L`

2. [ ] Shared Core Utilities Package — Create `@wdio/native-utils` package extracting common functionality from electron service (binary path resolution, service lifecycle, window management abstractions, configuration parsing) that can be reused across all framework services. `M`

3. [ ] Flutter Service — Implement `@wdio/flutter-service` leveraging existing Appium Flutter Driver integration, with automatic binary detection for Flutter builds, Appium capability configuration, and WebdriverIO command wrappers for Flutter-specific interactions (byValueKey, byType, tap, scroll, waitForWidget, etc.). Support iOS, Android, Windows, macOS, Linux. Set up CI/CD for multi-platform testing (Android emulator, iOS simulator, desktop builds). Includes comprehensive package tests and E2E test suite ported from Electron service patterns, with test fixtures for all 5 platforms. `L`

4. [ ] Neutralino Service — Implement `@wdio/neutralino-service` with binary detection for Neutralino builds, chrome mode integration for reliable cross-platform WebDriver support, WebSocket API bridge to C++ backend, window management, and extensions system integration. Support window mode for Windows/Linux (with macOS chrome mode fallback), implement frontend API mocking patterns, create extension templates for test automation, and document remote debugging setup per platform. Set up CI/CD for desktop platform testing. Includes comprehensive package tests and E2E test suite ported from Electron/Flutter test patterns. `L`

5. [ ] Tauri Service — Implement `@wdio/tauri-service` with official tauri-driver integration for WebDriver support, automatic binary detection from Tauri CLI builds, configuration parsing (tauri.conf.json), and standard Tauri command invocation wrappers. Add convenience commands for Tauri IPC patterns, implement frontend API mocking and Tauri command mocking utilities, provide window management helpers, and document backend testing patterns using standard Tauri commands. Validate cross-platform compatibility on Windows and Linux. Set up CI/CD for desktop platform testing. Includes comprehensive package tests and E2E test suite ported from Electron/Flutter/Neutralino test patterns. `L`

6. [ ] Shared Test Utilities and Cross-Service Documentation — Extract common test patterns from service implementations into `@wdio/service-test-utils` package for reuse. Create shared test utilities (ServiceTestBase, MockFactories, FixtureHelpers) that work across all services. Write comprehensive migration guides, comparison documentation between services, and test porting guides. Document test reuse patterns and cross-service testing strategies. `M`

7. [ ] Advanced Features: Standalone Mode and Multiremote — Ensure all services support WebdriverIO standalone mode for scripting, validate multiremote configurations work across services (multiple instances of same app, app + browser combinations), document advanced use cases including mobile device testing for Flutter. `M`

8. [ ] Performance Optimization and CI Improvements — Optimize test execution speed across all services, implement test result caching in CI, add performance benchmarks for service startup time, reduce package bundle sizes, improve parallel test reliability across desktop and mobile platforms. `M`

9. [ ] Community Growth and Ecosystem Integration — Publish comprehensive documentation site, create video tutorials and getting-started guides for desktop and mobile testing, integrate with WebdriverIO configuration wizard, establish community contribution guidelines, present at conferences and write blog posts to drive adoption. `L`

> Notes
> - Each item represents an end-to-end feature deliverable with both implementation and testing complete
> - **Item #1 combines infrastructure and migration:** Set up monorepo alongside Electron migration to establish CI/CD based on real requirements, not guesswork
> - **Service items combine foundation and advanced features:** Each service (Items #3-5) includes complete implementation, not split into MVP + enhancements
> - **Testing strategy:** Each service (Items #3-5) includes comprehensive package tests and E2E test suite ported from Electron patterns, ensuring self-validation before moving forward
> - **CI/CD integration:** Each service sets up platform-specific CI (Flutter: mobile emulators + desktop, Neutralino/Tauri: desktop platforms)
> - **Test reuse:** Flutter service (Item #3) includes test analysis phase to create porting guide for Neutralino/Tauri teams
> - **Item #6 focus:** Extract common test patterns into shared utilities after services proven, not write E2E tests (done per-service)
> - Order prioritizes establishing foundation (monorepo + electron) before building new services
> - **Flutter and Neutralino can be developed in parallel** (different scopes: mobile+desktop vs desktop-only)
> - Flutter prioritized for mobile testing capability (aligns with repository name: desktop-and-mobile-testing)
> - Neutralino provides lightweight desktop alternative to Electron with chrome mode reliability
> - Tauri follows after Flutter/Neutralino to benefit from lessons learned in platform-specific WebDriver management
> - Shared utilities extracted after electron service migration to avoid premature abstraction
> - Cross-service features (standalone, multiremote) come after core services are stable
> - Community growth is continuous but formalized as final phase after technical foundation is solid

## Implementation Timeline

**Q1 2026: Foundation (Weeks 1-9)**
- Item 1: Monorepo Foundation with Electron Service - 4-5 weeks (combined infrastructure + migration + CI)
- Item 2: Shared Core Utilities - 3-4 weeks

**Q2 2026: Parallel Development (Weeks 10-27)**
- Item 3: Flutter Service (Team A) - Mobile + Desktop - 12-17 weeks (complete service with E2E + CI)
- Item 4: Neutralino Service (Team B) - Desktop - 13-17 weeks (complete service with E2E + CI)

**Q3 2026: Tauri Service (Weeks 28-44)**
- Item 5: Tauri Service - Desktop + Experimental Mobile - 12-16 weeks (complete service with E2E + CI)

**Q4 2026: Stabilization (Weeks 45+)**
- Items 6-9: Shared test utilities extraction, advanced features, performance, community growth
