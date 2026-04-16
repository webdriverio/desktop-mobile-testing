# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


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
