# Monorepo Setup Guide

This guide will help you set up the WebdriverIO Cross-Platform Testing Services monorepo for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 LTS or 20 LTS
  ```bash
  node --version  # Should be v18.x or v20.x
  ```

- **pnpm**: Version 10.12.0 or higher
  ```bash
  npm install -g pnpm
  pnpm --version  # Should be 10.12.0+
  ```

- **Git**: For version control
  ```bash
  git --version
  ```

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/webdriverio-community/wdio-desktop-mobile-testing.git
cd wdio-desktop-mobile-testing
```

### 2. Install Dependencies

```bash
pnpm install
```

This will:
- Install all root-level dependencies
- Install dependencies for all packages
- Link workspace packages together
- Set up Git hooks with Husky

### 3. Build All Packages

```bash
pnpm turbo build
```

This builds all packages in the correct dependency order using Turborepo's intelligent caching.

### 4. Run Tests

```bash
pnpm test
```

This runs tests for all packages and ensures everything is working correctly.

## Development Workflow

### Building Packages

```bash
# Build all packages
pnpm turbo build

# Build a specific package
pnpm --filter @wdio/electron-utils build
pnpm --filter wdio-electron-service build

# Clean and rebuild
pnpm clean
pnpm turbo build
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests for specific package
pnpm --filter @wdio/electron-utils test

# Run tests in watch mode
pnpm --filter @wdio/electron-utils vitest
```

### Code Quality

```bash
# Lint all packages
pnpm lint

# Lint and auto-fix
pnpm lint:fix

# Format code
pnpm format

# Type check all packages
pnpm typecheck
```

### Development Mode

```bash
# Watch mode for all packages
pnpm dev

# Watch mode for specific package
pnpm --filter wdio-electron-service dev
```

## Monorepo Structure

```
wdio-desktop-mobile-testing/
├── .github/
│   └── workflows/          # CI/CD workflows
├── packages/               # All packages
│   ├── @wdio/             # Scoped utility packages
│   │   ├── electron-utils/
│   │   ├── electron-cdp-bridge/
│   │   └── native-utils/
│   └── wdio-electron-service/  # Service packages
├── examples/              # Example applications
├── e2e/                  # E2E test scenarios
├── docs/                 # Documentation
├── scripts/              # Build and utility scripts
├── types/                # Shared type definitions
├── package.json          # Root package.json
├── pnpm-workspace.yaml   # Workspace configuration
├── turbo.json           # Turborepo configuration
├── tsconfig.base.json   # Base TypeScript config
└── vitest.config.ts     # Vitest configuration
```

## Working with Packages

### Adding a New Package

See [package-structure.md](./package-structure.md) for detailed guidelines.

Quick steps:

1. Create package directory: `packages/@wdio/my-package/`
2. Copy structure from `packages/@wdio/example-package/`
3. Update `package.json` with your package details
4. Implement your code in `src/`
5. Add tests in `test/`
6. Build: `pnpm --filter @wdio/my-package build`
7. Test: `pnpm --filter @wdio/my-package test`

### Adding Dependencies

```bash
# Add dependency to specific package
pnpm --filter @wdio/electron-utils add some-package

# Add dev dependency
pnpm --filter @wdio/electron-utils add -D some-dev-package

# Add workspace dependency
pnpm --filter wdio-electron-service add @wdio/electron-utils@workspace:*
```

### Using the Catalog

Common dependencies are managed through pnpm's catalog feature in `pnpm-workspace.yaml`.

To use a catalog dependency:

```json
{
  "devDependencies": {
    "typescript": "catalog:default",
    "vitest": "catalog:default"
  }
}
```

## Turborepo Caching

Turborepo caches task outputs to speed up subsequent runs.

### Local Cache

The local cache is stored in `.turbo/` and is automatically used.

### Cache Management

```bash
# Clear Turborepo cache
pnpm clean:cache

# Force rebuild (bypass cache)
pnpm turbo build --force
```

## Common Tasks

### Clean Everything

```bash
# Clean all build artifacts and caches
pnpm clean

# Clean just the Turbo cache
pnpm clean:cache
```

### Run CI Locally

```bash
# Run the same checks as CI
pnpm lint
pnpm typecheck
pnpm test
pnpm turbo build
```

### Update Dependencies

```bash
# Update all dependencies
pnpm update -r -i --latest

# Update specific package
pnpm --filter @wdio/electron-utils update some-package
```

## Troubleshooting

### "Cannot find module" errors

Try cleaning and reinstalling:

```bash
pnpm clean
pnpm install
pnpm turbo build
```

### TypeScript errors after adding dependencies

Rebuild the project:

```bash
pnpm turbo build --force
```

### Test failures

Make sure packages are built:

```bash
pnpm turbo build
pnpm test
```

### Pre-commit hooks not running

Reinstall Husky:

```bash
pnpm prepare
```

## IDE Setup

### VS Code

Recommended extensions:

- **ESLint**: Microsoft ESLint extension
- **Biome**: Biome formatter
- **TypeScript and JavaScript Language Features**: Built-in

Workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  }
}
```

## Next Steps

- Read [package-structure.md](./package-structure.md) for package conventions
- Read [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Check out example packages in `packages/@wdio/example-package/`
- Explore the Electron service implementation in `packages/wdio-electron-service/`

## Getting Help

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/webdriverio-community/wdio-desktop-mobile-testing/issues)
- **Discussions**: Ask questions on [GitHub Discussions](https://github.com/webdriverio-community/wdio-desktop-mobile-testing/discussions)
- **WebdriverIO**: See [WebdriverIO documentation](https://webdriver.io/)


