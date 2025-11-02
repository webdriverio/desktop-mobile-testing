# WebdriverIO Cross-Platform Testing Services

> Integration services for cross-platform testing on Electron, Tauri, Flutter, and Neutralino with WebdriverIO

## Overview

This monorepo contains WebdriverIO service packages for testing desktop and mobile applications across multiple frameworks:

- **Electron Service** - Test Electron applications with automatic binary detection, CDP bridge for main process access, and comprehensive API mocking
- **Tauri Service** - Test Tauri applications with official tauri-driver integration and multiremote support
- **Flutter Service** - Test Flutter apps on iOS, Android, Windows, macOS, and Linux with Appium integration (coming soon)
- **Neutralino Service** - Test Neutralino.js applications with WebSocket API bridge (coming soon)

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm turbo build

# Run tests
pnpm turbo test

# Run linting
pnpm turbo lint
```

## Project Structure

```
wdio-desktop-mobile-testing/
├── packages/               # Service packages
│   ├── electron-service/   # @wdio/electron-service
│   ├── tauri-service/      # @wdio/tauri-service
│   ├── electron-cdp-bridge/ # @wdio/electron-cdp-bridge
│   ├── electron-types/     # @wdio/electron-types
│   ├── native-utils/       # @wdio/native-utils
│   └── bundler/            # @wdio/bundler
├── fixtures/              # Test fixtures and example apps
│   ├── e2e-apps/         # E2E test applications
│   └── package-tests/    # Package test applications
├── e2e/                  # E2E test scenarios
├── docs/                 # Documentation
└── scripts/              # Build and utility scripts
```

## Packages

### Electron Service

Test Electron applications with WebdriverIO.

- 📦 **Package**: `@wdio/electron-service`
- 📖 **Docs**: [packages/electron-service/README.md](packages/electron-service/README.md)
- ✨ **Features**: Binary detection, CDP bridge, API mocking, window management

### Tauri Service

Test Tauri applications with WebdriverIO.

- 📦 **Package**: `@wdio/tauri-service`
- 📖 **Docs**: [packages/tauri-service/README.md](packages/tauri-service/README.md)
- ✨ **Features**: tauri-driver integration, multiremote support, binary detection

### Shared Utilities

Common utilities shared across all framework services.

- 📦 **Package**: `@wdio/native-utils`
- 📖 **Docs**: [packages/@wdio/native-utils/README.md](packages/@wdio/native-utils/README.md)

## Development

### Requirements

- Node.js 18 LTS or 20 LTS
- pnpm 10.12+

### Setup

```bash
# Install pnpm globally if you don't have it
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm turbo build
```

### Commands

```bash
# Development
pnpm dev                   # Watch mode for development
pnpm build                 # Build all packages
pnpm test                  # Run all tests
pnpm test:coverage         # Run tests with coverage

# Code Quality
pnpm lint                  # Lint all packages
pnpm lint:fix              # Lint and auto-fix
pnpm format                # Format code with Biome
pnpm typecheck             # Type check all packages

# Package-specific commands
pnpm --filter @wdio/native-utils build
pnpm --filter @wdio/electron-service test
pnpm --filter @wdio/tauri-service test

# E2E Testing
pnpm e2e                          # Run all E2E tests
pnpm e2e:electron-builder          # Run Electron builder tests
pnpm e2e:electron-forge            # Run Electron forge tests
pnpm e2e:electron-no-binary        # Run Electron no-binary tests
pnpm e2e:tauri                     # Run Tauri tests
```

### Adding a New Package

See [docs/package-structure.md](docs/package-structure.md) for guidelines on creating new packages.

## Testing

This project maintains 80%+ test coverage across all packages. Tests are organized as:

- **Unit tests**: Fast, isolated tests for individual modules
- **Integration tests**: Tests for package interactions
- **E2E tests**: End-to-end tests with real applications

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @wdio/electron-service test
pnpm --filter @wdio/tauri-service test

# Run with coverage
pnpm test:coverage

# Run E2E tests
pnpm e2e                          # All E2E tests
pnpm e2e:electron-builder          # Electron builder E2E
pnpm e2e:electron-forge            # Electron forge E2E
pnpm e2e:tauri                     # Tauri E2E

# Run package tests (isolated test apps)
pnpm test:package                 # Both Electron and Tauri
pnpm test:package:electron        # Electron only
pnpm test:package:tauri           # Tauri only
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork and clone the repository
2. Create a new branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Run linting: `pnpm lint:fix`
6. Commit your changes (pre-commit hooks will run automatically)
7. Push and create a pull request

## Architecture

This monorepo uses:

- **pnpm workspaces** - Efficient package management and linking
- **Turborepo** - Fast, incremental builds with smart caching
- **TypeScript** - Type-safe development with dual ESM/CJS builds
- **Vitest** - Fast unit and integration testing
- **Biome** - Fast formatting and linting
- **GitHub Actions** - Multi-platform CI/CD

See [docs/architecture.md](docs/architecture.md) for more details (coming soon).

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [WebdriverIO](https://webdriver.io/)
- [Documentation](https://webdriver.io/docs/desktop-testing/electron)
- [Community](https://github.com/webdriverio-community)

---

**Starting commit**: `e728cf1` (chore: add agentos)
