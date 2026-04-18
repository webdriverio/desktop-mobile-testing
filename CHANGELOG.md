# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).



## [@wdio/native-utils@2.1.0] - 2026-04-18

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/wdio-native-utils@v2.0.0...2.1.0)

### Changed
- Update version to 2.1.0

## [@wdio/tauri-service@1.0.0-next.0] - 2026-04-17

[Full Changelog](https://github.com/webdriverio/desktop-mobile.git/compare/1.0.0-next.0...1.0.0-next.0)

### Added
- implement CrabNebula backend cycling for multiremote instances on macOS (#184)
- implement per-worker backend management for CrabNebula, enable E2E testing (#171)
- **tauri**: add embedded WebDriver provider support (#166)
- standardise tauri API with electron (#146)
- complete tauri mocking (#143)
- tauri deeplinking (#128)
- CrabNebula support (#122)
- tauri window management (#106)
- `@wdio/native-spy` (#88)
- js-only mocking, logging rework (#67)
- ci release workflows (#53)
- `tauri-driver` management (#42)
- **tauri**: logging integration (#39)
- tauri plugin (#23)
- tauri package tests (#19)
- ensure multiremote works with the tauri service (#17)
- tauri service (#6)

### Changed
- update package.json homepage and repository URLs for multiple packages
- update dependencies (#230)
- enhance setup and development documentation
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- **tauri**: rework documentation (#193)
- rename tauri-plugin-wdio-server to tauri-plugin-wdio-webdriver and update related configurations (#182)
- update package.json files to enable releases
- types (#174)
- **electron**: update createElectronCapabilities interface (#165)
- electron service standardisation with tauri, update agent-os standards (#158)
- tauri service & plugin review (perf, maintainability) (#150)
- change button style
- rework, fill in gaps (#105)
- remove backporting / LTS approach (#104)
- rename repo, docs rework (#95)
- fix parsing for windows
- fix linting issues
- **release**: @wdio/tauri-service, @wdio/tauri-plugin 1.0.0-next.0
- add badges
- fix linting errors
- update deps
- standardise published files, add LICENSE
- standardise published files
- update versions & homepage values
- clean up and separate types (#52)

### Fixed
- **tauri**: improve error handling and response mapping (#198)
- increase embedded WebDriver start timeout for CI environments
- ensure browser is defined before restoring mocks
- codeQL scanning alert no. 59: Unsafe shell command constructed from library input (#119)
- CodeQL code scanning alert no. 58, 59, 60, 62: Unsafe shell command constructed from library input (#117)

## [@wdio/tauri-plugin@1.0.0-next.0] - 2026-04-17

### Added
- **tauri**: add embedded WebDriver provider support (#166)
- standardise tauri API with electron (#146)
- complete tauri mocking (#143)
- tauri window management (#106)
- js-only mocking, logging rework (#67)
- ci release workflows (#53)
- **tauri**: logging integration (#39)
- tauri plugin (#23)

### Changed
- update package.json homepage and repository URLs for multiple packages
- update dependencies (#230)
- update Node.js engine requirements across multiple packages
- update dependencies and improve package configurations (#203)
- **tauri**: rework documentation (#193)
- update tauri-plugin and tauri-plugin-server configurations (#177)
- update package.json files to enable releases
- **electron**: update createElectronCapabilities interface (#165)
- tauri service & plugin review (perf, maintainability) (#150)
- update for puppeteer release (#132)
- rework, fill in gaps (#105)
- rename repo, docs rework (#95)
- fix linting issues
- **release**: @wdio/tauri-service, @wdio/tauri-plugin 1.0.0-next.0
- add badges
- update deps
- standardise published files, add LICENSE
- update versions & homepage values
- **electron**: move esm / cjs testing from e2es to package tests (#38)
