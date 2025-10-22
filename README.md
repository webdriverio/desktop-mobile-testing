# WebdriverIO Cross-Platform Testing Services

> Integration services for cross-platform testing on Electron, Flutter, Neutralino, and Tauri with WebdriverIO

## Overview

This monorepo contains WebdriverIO service packages for testing desktop and mobile applications across multiple frameworks:

- **Electron Service** - Test Electron applications with automatic binary detection, CDP bridge for main process access, and comprehensive API mocking
- **Flutter Service** - Test Flutter apps on iOS, Android, Windows, macOS, and Linux with Appium integration (coming soon)
- **Neutralino Service** - Test Neutralino.js applications with WebSocket API bridge (coming soon)
- **Tauri Service** - Test Tauri applications with official tauri-driver integration (coming soon)

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
│   ├── @wdio/
│   │   ├── electron-utils/
│   │   ├── electron-cdp-bridge/
│   │   └── native-utils/
│   └── wdio-electron-service/
├── examples/              # Example applications
├── e2e/                  # E2E test scenarios
├── docs/                 # Documentation
└── scripts/              # Build and utility scripts
```

## Packages

### Electron Service

Test Electron applications with WebdriverIO.

- 📦 **Package**: `wdio-electron-service`
- 📖 **Docs**: [packages/wdio-electron-service/README.md](packages/wdio-electron-service/README.md)
- ✨ **Features**: Binary detection, CDP bridge, API mocking, window management

### Shared Utilities

Common utilities shared across all framework services.

- 📦 **Package**: `@wdio/native-utils`
- 📖 **Docs**: [packages/@wdio/native-utils/README.md](packages/@wdio/native-utils/README.md) (coming soon)

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
pnpm --filter @wdio/electron-utils build
pnpm --filter wdio-electron-service test
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
pnpm --filter wdio-electron-service test

# Run with coverage
pnpm test:coverage
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
