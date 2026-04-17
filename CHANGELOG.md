# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [@wdio/electron-service@10.0.0-next.6] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/10.0.0-next.6...10.0.0-next.6)

### Added
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- tauri deeplinking (#128)
- `@wdio/native-spy` (#88)
- js-only mocking, logging rework (#67)
- class mocks (#73)
- add support for electron-builder custom config files (#65)
- deeplink testing (#60)
- **electron**: port logging improvements to electron service (#57)
- ci release workflows (#53)
- **electron-service**: stub bridge API and improved guarding around bridge init (#50)
- tauri plugin (#23)
- ensure multiremote works with the tauri service (#17)
- tauri service (#6)
- migrate electron service

### Changed
- update package.json homepage and repository URLs for multiple packages
- update dependencies (#230)
- rework release workflows for releasekit (#217)
- enhance setup and development documentation
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- **electron**: address lint warnings
- replace `read-package-up` with custom implementation
- use custom implementation of `read-package-up`
- migrate `readPackageUp` function to `@wdio/native-utils` and update imports in launcher and pathResolver
- replace direct import of `read-package-up` with dynamic import in launcher and pathResolver
- update `read-package-up`
- **electron**: improve error handling and logging in Electron service (#197)
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.6
- moved `@wdio/native-spy` dependency to devDeps
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.5
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.4
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.3
- update package.json files to enable releases
- types (#174)
- **electron**: update createElectronCapabilities interface (#165)
- remove unnecessary TypeScript directive in fuse check function
- **electron**: review and fix issues
- electron service standardisation with tauri, update agent-os standards (#158)
- electron service review (#153)
- change button style
- update for puppeteer release (#132)
- rework, fill in gaps (#105)
- remove backporting / LTS approach (#104)
- rename repo, docs rework (#95)
- fix linting issues
- update mock types
- tweak mock types
- standardize E2E apps (#72)
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.2
- use official types for `electron-to-chromium`
- add overrides
- debug
- enable logs for package tests
- use packed webdriverio & puppeteer
- update deps
- update puppeteer
- clean up deeplink timeout, remove tests
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge, @wdio/bundler 10.0.0-next.1
- add docs back to package
- fix trusted publishing
- downgrade `read-package-up`
- ignore `useArrowFunction` for vitest.fn invocation
- fix ts error
- fix linting errors
- update import
- update deps
- standardise published files, add LICENSE
- standardise published files
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge, @wdio/bundler 10.0.0-next.0
- update versions & homepage values
- reinstate bundler conf
- update URLs
- update package name & path

### Fixed
- **electron**: update default value in package reading logic
- native-spy bundler issues (#183)
- update logging and logic
- windows path corruption
- mockRestore should restore original func behaviour
- mock E2Es
- mock creation
- update for vitest fn

## [@wdio/electron-cdp-bridge@10.0.0-next.6] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/10.0.0-next.6...10.0.0-next.6)

### Added
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- deeplink testing (#60)
- ci release workflows (#53)
- tauri service (#6)
- migrate electron service

### Changed
- update package.json homepage and repository URLs for multiple packages
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.6
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.5
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.4
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.3
- update package.json files to enable releases
- **electron**: update createElectronCapabilities interface (#165)
- rename repo, docs rework (#95)
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge 10.0.0-next.2
- update deps
- add badges
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge, @wdio/bundler 10.0.0-next.1
- fix trusted publishing
- update deps
- add cdp bridge readme
- standardise published files, add LICENSE
- **release**: @wdio/electron-service, @wdio/electron-cdp-bridge, @wdio/bundler 10.0.0-next.0
- update versions & homepage values
