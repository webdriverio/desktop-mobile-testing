# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).












## @wdio/native-utils@2.0.0 - 2026-04-17

### Added
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- add support for electron-builder custom config files (#65)
- deeplink testing (#60)
- ci release workflows (#53)
- tauri plugin (#23)
- ensure multiremote works with the tauri service (#17)
- tauri service (#6)

### Changed
- add README files for @wdio/native-types and @wdio/native-utils
- update package.json homepage and repository URLs for multiple packages
- update dependencies (#230)
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- replace `read-package-up` with custom implementation
- use custom implementation of `read-package-up`
- migrate `readPackageUp` function to `@wdio/native-utils` and update imports in launcher and pathResolver
- update `read-package-up`
- update package.json files to enable releases
- types (#174)
- **electron**: update createElectronCapabilities interface (#165)
- electron service standardisation with tauri, update agent-os standards (#158)
- rename repo, docs rework (#95)
- standardize E2E apps (#72)
- extend path creation for `linux/arm64`
- fix trusted publishing
- downgrade `read-package-up`
- update deps
- standardise published files, add LICENSE
- release @wdio/native-utils@2.0.0 [skip-ci]
- fix tarball bloat
- update versions & homepage values

### Fixed
- update files field in package.json to simplify file inclusion
- update files field in package.json to include all dist files

## [@wdio/native-types@2.1.0] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-types@v2.0.0...2.1.0)

### Changed
- Update version to 2.1.0

## @wdio/native-types@2.0.0 - 2026-04-17

### Added
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- **tauri**: add embedded WebDriver provider support (#166)
- standardise tauri API with electron (#146)
- complete tauri mocking (#143)
- tauri deeplinking (#128)
- CrabNebula support (#122)
- `@wdio/native-spy` (#88)
- js-only mocking, logging rework (#67)
- class mocks (#73)
- add support for electron-builder custom config files (#65)
- deeplink testing (#60)
- **electron**: port logging improvements to electron service (#57)
- ci release workflows (#53)
- **tauri**: logging integration (#39)
- tauri plugin (#23)

### Changed
- add README files for @wdio/native-types and @wdio/native-utils
- update package.json homepage and repository URLs for multiple packages
- update dependencies (#230)
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- replace `read-package-up` with custom implementation
- use custom implementation of `read-package-up`
- update `read-package-up`
- update package.json files to enable releases
- types (#174)
- **electron**: update createElectronCapabilities interface (#165)
- rename repo, docs rework (#95)
- tweak mock types
- use packed webdriverio & puppeteer
- update deps
- fix trusted publishing
- downgrade `read-package-up`
- update deps
- standardise published files, add LICENSE
- release @wdio/native-types@2.0.0 [skip-ci]
- fix tarball bloat
- update versions & homepage values
- clean up and separate types (#52)

### Fixed
- update files field in package.json to simplify file inclusion
- update files field in package.json to include all dist files

## [@wdio/native-spy@1.0.9] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.6...1.0.9)

### Changed
- bump version of @wdio/native-spy to 1.0.8
- bump version of @wdio/native-spy to 1.0.7

## [@wdio/native-spy@1.0.6] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.5...1.0.6)

### Changed
- Update version to 1.0.6

## [@wdio/native-spy@1.0.5] - 2026-04-16

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.4...1.0.5)

### Fixed
- simplify files inclusion in package.json for @wdio/native-spy

## [@wdio/native-spy@1.0.4] - 2026-04-16

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.3...1.0.4)

### Changed
- Update version to 1.0.4

## [@wdio/native-spy@1.0.3] - 2026-04-16

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.2...1.0.3)

### Fixed
- ensure dist files are explicitly included in published package

## [@wdio/native-spy@1.0.2] - 2026-04-16

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.1...1.0.2)

### Fixed
- update files field in package.json to simplify file inclusion

## [@wdio/native-spy@1.0.1] - 2026-04-16

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-spy@v1.0.0...1.0.1)

### Fixed
- ensure dist files are included in published package

## @wdio/native-spy@1.0.0 - 2026-04-16

### Added
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- tauri window management (#106)
- `@wdio/native-spy` (#88)

### Changed
- update package.json homepage and repository URLs for multiple packages
- release version 1.0.0 for @wdio/native-spy
- bump version to 1.0.0-next.1 in package.json for @wdio/native-spy
- update package.json for public access and provenance
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- update native-spy version to 1.0.0-next.0
- update package.json files to enable releases
- **electron**: update createElectronCapabilities interface (#165)
- rename repo, docs rework (#95)

## [Unreleased]

### Repository
- Established monorepo structure for WebdriverIO desktop and mobile testing services
- Migrated Electron service from legacy [wdio-electron-service](https://github.com/webdriverio-community/wdio-electron-service) repository
- Added Tauri service with plugin support
- Implemented shared utilities for cross-platform native app testing

---

## [@wdio/electron-service@10.0.0-next.2]

### Added
- Migrated from legacy repository to unified desktop-mobile monorepo
- Full CDP bridge for main process access
- Comprehensive API mocking and stubbing capabilities
- Window management and lifecycle control

### Changed
- Package structure aligned with monorepo standards
- Updated dependencies to latest versions

## [@wdio/tauri-service@1.0.0-next.0]

### Added
- Initial Tauri service implementation
- Official tauri-driver integration
- Tauri plugin for backend testing capabilities
- Multiremote testing support
- Plugin-based architecture

## [@wdio/native-utils@2.0.0]

### Added
- Cross-platform binary detection utilities
- Configuration parsing helpers
- Shared utilities for Electron and Tauri services

## [@wdio/native-types@2.0.0]

### Added
- TypeScript type definitions for Electron APIs
- TypeScript type definitions for Tauri APIs
- Shared native types

## [@wdio/electron-cdp-bridge@10.0.0-next.2]

### Added
- Chrome DevTools Protocol bridge for main process communication
- API mocking infrastructure

## [@wdio/tauri-plugin@1.0.0-next.0]

### Added
- Tauri v2 plugin providing backend access for testing
- Frontend JavaScript API
- Rust backend implementation

---

[Unreleased]: https://github.com/webdriverio/desktop-mobile/compare/HEAD
[@wdio/electron-service@10.0.0-next.2]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Felectron-service%4010.0.0-next.2
[@wdio/tauri-service@1.0.0-next.0]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Ftauri-service%401.0.0-next.0
[@wdio/native-utils@2.0.0]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Fnative-utils%402.0.0
[@wdio/native-types@2.0.0]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Fnative-types%402.0.0
[@wdio/electron-cdp-bridge@10.0.0-next.2]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Felectron-cdp-bridge%4010.0.0-next.2
[@wdio/tauri-plugin@1.0.0-next.0]: https://github.com/webdriverio/desktop-mobile/releases/tag/%40wdio%2Ftauri-plugin%401.0.0-next.0
