# WebdriverIO Desktop & Mobile Testing

> WebdriverIO services for automated testing of native desktop and mobile applications

[![@wdio/electron-service](https://img.shields.io/badge/@wdio-electron--service-9feaf9?style=for-the-badge&labelColor=1a1a1a)](https://www.npmjs.com/package/@wdio/electron-service)
[![Version](https://img.shields.io/npm/v/@wdio/electron-service?color=28a745&labelColor=1a1a1a&style=for-the-badge)](https://www.npmjs.com/package/@wdio/electron-service)
[![Downloads](https://img.shields.io/npm/dw/@wdio/electron-service?color=6f42c1&labelColor=1a1a1a&style=for-the-badge)](https://www.npmjs.com/package/@wdio/electron-service)

[![@wdio/tauri-service](https://img.shields.io/badge/@wdio-tauri--service-FFC131?style=for-the-badge&labelColor=1a1a1a)](https://www.npmjs.com/package/@wdio/tauri-service)
[![Version](https://img.shields.io/npm/v/@wdio/tauri-service?color=28a745&labelColor=1a1a1a&style=for-the-badge)](https://www.npmjs.com/package/@wdio/tauri-service)
[![Downloads](https://img.shields.io/npm/dw/@wdio/tauri-service?color=6f42c1&labelColor=1a1a1a&style=for-the-badge)](https://www.npmjs.com/package/@wdio/tauri-service)

## Supported Frameworks

- **[@wdio/electron-service](./packages/electron-service)** - Electron applications \
  CDP bridge for main process • Full API mocking • Window management

- **[@wdio/tauri-service](./packages/tauri-service)** - Tauri applications \
  Official tauri-driver integration • Multiremote support • Plugin architecture

### Planned / In Development

- **React Native** - iOS/Android (Experimental support for Windows/macOS)
- **Flutter** - iOS/Android/Windows/macOS/Linux
- **Neutralino** - Windows/macOS/Linux

## Features

- 🎯 **Framework-specific automation** - Native integration with Electron, Tauri
- 🔍 **Smart binary detection** - Automatic app discovery and configuration
- 🎭 **API mocking & isolation** - Built-in mocking for deterministic tests
- 🌐 **Cross-platform support** - Write once, test everywhere
- 🔧 **Consistent API** - Familiar WDIO patterns across all frameworks

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Project Structure

```
desktop-mobile/
├── packages/                    # Service packages
│   ├── electron-service/        # Electron service implementation
│   ├── tauri-service/           # Tauri service implementation
│   ├── electron-cdp-bridge/     # Chrome DevTools Protocol bridge
│   ├── native-utils/            # Cross-platform utilities
│   ├── native-types/            # TypeScript type definitions
│   ├── bundler/                 # Build tool for packaging
│   └── tauri-plugin/            # Tauri plugin for backend access
├── fixtures/                   # Test fixtures and example apps
│   ├── e2e-apps/               # E2E test applications
│   ├── package-tests/          # Package integration tests
│   └── config-formats/         # Configuration format test fixtures
├── e2e/                        # End-to-end test suites
│   ├── test/                   # Test specifications
│   │   ├── electron/           # Electron E2E tests
│   │   └── tauri/              # Tauri E2E tests
│   └── scripts/                # Test execution scripts
├── docs/                       # Documentation
└── scripts/                    # Build and utility scripts
```

## Services

### Electron Service

Production-ready WebdriverIO service for testing Electron applications with advanced features.

- 📦 **Package**: `@wdio/electron-service`
- 📖 **Docs**: [packages/electron-service/README.md](packages/electron-service/README.md)
- ✨ **Features**:
  - Automatic Electron binary detection and management
  - CDP bridge for main process API access
  - Comprehensive API mocking and stubbing
  - Window management and lifecycle control
  - Deep link testing support
  - Multi-instance testing capabilities

### Tauri Service

Full-featured WebdriverIO service for testing Tauri applications with native integration.

- 📦 **Package**: `@wdio/tauri-service`
- 📖 **Docs**: [packages/tauri-service/README.md](packages/tauri-service/README.md)
- ✨ **Features**:
  - Official tauri-driver integration
  - Multiremote testing support
  - Plugin-based architecture
  - Automatic binary detection
  - Advanced execute capabilities

### Supporting Packages

- **@wdio/native-utils** - Cross-platform utilities for binary detection and config parsing
- **@wdio/native-types** - TypeScript type definitions for Electron and Tauri APIs
- **@wdio/electron-cdp-bridge** - Chrome DevTools Protocol bridge for main process communication
- **@wdio/bundler** - Build tool for packaging and bundling service packages
- **@wdio/tauri-plugin** - Tauri plugin providing backend access capabilities for testing

## Development

### Requirements

- Node.js 18 LTS or 20 LTS
- pnpm 10.27.0+

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Commands

```bash
# Development
pnpm build                 # Build all packages
pnpm dev                   # Watch mode for development
pnpm clean                 # Clean all build artifacts

# Testing
pnpm test                  # Run all tests
pnpm test:unit             # Run unit tests only
pnpm test:integration      # Run integration tests
pnpm test:coverage         # Run tests with coverage
pnpm test:package          # Run package integration tests
pnpm test:package:electron # Test Electron package integration
pnpm test:package:tauri    # Test Tauri package integration

# Code Quality
pnpm lint                  # Lint and format check
pnpm lint:fix              # Auto-fix linting issues
pnpm format                # Format code with Biome
pnpm typecheck             # Type check all packages

# E2E Testing
pnpm e2e                   # Run all E2E tests
pnpm e2e:electron-builder  # Electron builder E2E tests
pnpm e2e:electron-forge    # Electron forge E2E tests
pnpm e2e:electron-script   # Electron script E2E tests
pnpm e2e:tauri             # Tauri E2E tests
pnpm e2e:standalone        # Standalone mode tests
pnpm e2e:multiremote       # Multiremote tests

# Package Management
pnpm release               # Release packages
pnpm catalog:update        # Update dependency catalogs
pnpm backport              # Run backport script
```

## Testing

### Test Commands

```bash
# Core Testing
pnpm test                  # Run all unit and integration tests
pnpm test:unit             # Unit tests only
pnpm test:integration      # Integration tests only
pnpm test:coverage         # Run with coverage reporting

# Package Integration Testing
pnpm test:package          # Test published packages in isolation
pnpm test:package:electron # Electron package integration tests
pnpm test:package:tauri    # Tauri package integration tests

# End-to-End Testing
pnpm e2e                   # All E2E test suites
pnpm e2e:electron-builder  # Electron builder applications
pnpm e2e:electron-forge    # Electron forge applications
pnpm e2e:electron-script   # Electron without pre-built binaries
pnpm e2e:tauri             # Tauri applications
pnpm e2e:standalone        # Standalone mode testing
pnpm e2e:multiremote       # Multiremote browser testing
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Architecture

This monorepo is built with modern development tools and practices:

### Tech Stack

- **📦 pnpm workspaces** - Efficient monorepo package management
- **⚡ Turborepo** - Fast, incremental builds with intelligent caching
- **🔷 TypeScript** - Type-safe development with dual ESM/CJS builds
- **🧪 Vitest** - Fast unit and integration testing framework
- **🎨 Biome** - High-performance formatting and linting
- **🌐 WebdriverIO** - Next-gen browser and mobile automation framework
- **🎭 Puppeteer** - Headless Chrome/Node.js API for browser automation
- **🔧 Chrome DevTools Protocol** - Protocol for browser debugging and automation
- **⚛️ Electron** - Cross-platform desktop application framework
- **🦀 Tauri** - Modern desktop application framework
- **⚛️ electron-vite** - Modern build tool for Electron applications
- **🤖 GitHub Actions** - Comprehensive CI/CD with multi-platform testing

## License

MIT License - see [LICENSE](LICENSE) for details.

## Community & Support

- [WebdriverIO](https://webdriver.io) - Main WebdriverIO project
- [WebdriverIO Docs](https://webdriver.io/docs/gettingstarted) - Official documentation
- [WebdriverIO Community](https://github.com/webdriverio-community) - Community resources
- [GitHub Issues](https://github.com/webdriverio/desktop-mobile/issues) - Bug reports and feature requests

## Related Projects

- [wdio-electron-service](https://github.com/webdriverio-community/wdio-electron-service) - Legacy Electron service repo
- [tauri-driver](https://github.com/elvis-epx/tauri-driver) - Official Tauri WebDriver implementation
