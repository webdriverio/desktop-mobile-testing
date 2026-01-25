# Development

Guide for developing and contributing to @wdio/tauri-service.

## Prerequisites

Development of the Tauri service requires:

1. **Node.js 18 LTS or 20 LTS** - Use [NVM](https://github.com/nvm-sh/nvm) for version management
2. **pnpm 10.12.0+** - Install via `npm install -g pnpm`
3. **Git** - Version control
4. **Rust Toolchain** - Required for building Tauri apps and tauri-driver
   ```bash
   rustc --version
   cargo --version
   ```

## Repository Structure

The Tauri service is part of a monorepo. Key directories:

```
packages/tauri-service/
├── src/
│   ├── index.ts              # Main service class and exports
│   ├── types.ts              # TypeScript type definitions
│   ├── edgeDriverManager.ts   # Windows Edge WebDriver management
│   └── utils/                # Utility functions
├── docs/                      # Documentation
├── test/                      # Unit tests
├── package.json
└── tsconfig.json

packages/tauri-plugin/
├── src/                       # Rust backend
└── guest-js/                  # JavaScript frontend

packages/native-types/
└── src/tauri.ts               # Shared type definitions
```

## Getting Started

### Clone and Setup Workspace

```bash
# Clone the monorepo
git clone https://github.com/webdriverio/desktop-mobile.git
cd desktop-mobile

# Install all workspace dependencies
pnpm install

# Build all packages
pnpm turbo build
```

### Build Tauri Service

```bash
# From workspace root
pnpm --filter @wdio/tauri-service build

# Or from package directory
cd packages/tauri-service
pnpm build
```

### Watch Mode During Development

Rebuild files automatically as you make changes:

```bash
# From workspace root - rebuild tauri-service on changes
pnpm --filter @wdio/tauri-service dev

# Or from package directory
cd packages/tauri-service
pnpm dev
```

## Testing

### Running Tests

```bash
# Run all tauri-service tests
pnpm --filter @wdio/tauri-service test

# Run tests in watch mode
pnpm --filter @wdio/tauri-service test:watch

# Run tests with coverage
pnpm --filter @wdio/tauri-service test:coverage
```

### Writing Tests

Tests use [Vitest](https://vitest.dev/). Structure:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    // Test implementation
    expect(result).toBe(expected);
  });

  afterEach(() => {
    // Cleanup
  });
});
```

### Test Coverage

- Aim for 80%+ coverage
- Test edge cases and error conditions
- Mock external dependencies where needed

## Code Quality

### Formatting and Linting

The monorepo uses [Biome](https://biomejs.dev/) for formatting and linting:

```bash
# Check formatting (no changes)
pnpm format:check

# Format files
pnpm format

# Lint with Biome
pnpm lint

# Lint with fixes
pnpm lint:fix
```

### Code Style Guidelines

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Use **trailing commas** in objects/arrays
- Max line length: **120 characters**
- Use **arrow functions** for callbacks
- Avoid `any` type - use proper TypeScript
- Document public APIs with JSDoc comments

Example:

```typescript
/**
 * Execute JavaScript code in the Tauri app context.
 * @param browser - WebdriverIO browser instance
 * @param script - JavaScript code to execute
 * @param args - Arguments passed to script
 * @returns Result of script execution
 */
export async function execute(
  browser: WebdriverIO.Browser,
  script: string,
  ...args: any[]
): Promise<any> {
  // Implementation
}
```

## Making Changes

### Creating a Feature

1. Create a branch:
   ```bash
   git checkout -b feature/my-feature
   ```

2. Implement your feature:
   - Add/modify code in `src/`
   - Update types in `src/types.ts` if needed
   - Write tests in `test/`

3. Verify changes:
   ```bash
   pnpm lint:fix
   pnpm test
   pnpm build
   ```

4. Update documentation if needed:
   - Update relevant files in `docs/`
   - Add examples to `docs/usage-examples.md`
   - Update `docs/api-reference.md` for new APIs

5. Commit with conventional commit message:
   ```bash
   git commit -m "feat(tauri): add new feature description"
   ```

### Fixing a Bug

1. Create a test case that reproduces the bug (TDD approach)
2. Implement the fix
3. Verify test passes
4. Run full test suite to ensure no regressions:
   ```bash
   pnpm test
   ```

## Key Features of Tauri Service

### Windows Edge WebDriver Management

Located in `src/edgeDriverManager.ts`:

- Detects WebView2 version from Tauri binary
- Auto-downloads matching MSEdgeDriver from Microsoft CDN
- Handles version mismatches

### Plugin Communication

The tauri-plugin-wdio provides:

- Script execution via `window.eval()`
- Command mocking via invoke interception
- Log forwarding via event listeners

### Cross-Platform Support

- **Windows**: Edge WebDriver (auto-managed)
- **Linux**: WebKitWebDriver (manual install)
- **macOS**: Not supported (WKWebView limitation)

## Common Tasks

### Add a New Service Option

1. Add to `TauriServiceOptions` in `src/types.ts`
2. Add default value in service class
3. Document in `docs/configuration.md`
4. Add validation if needed
5. Write tests

### Add a New API Function

1. Implement in `src/`
2. Export from `src/index.ts`
3. Add TypeScript types
4. Document in `docs/api-reference.md`
5. Add example to `docs/usage-examples.md`
6. Write tests

### Fix a Platform-Specific Issue

1. Identify affected platforms (`windows`, `linux`, `darwin`)
2. Add platform detection if needed
3. Implement fix
4. Test on affected platforms (or add platform-specific tests)
5. Update `docs/platform-support.md` if relevant

## Contributing

### Before Opening a Pull Request

1. Run the full test suite:
   ```bash
   pnpm lint
   pnpm test
   pnpm build
   ```

2. Check for TypeScript errors:
   ```bash
   pnpm typecheck
   ```

3. Update tests and documentation for your changes

### General Guidelines

For general contributing guidelines, code of conduct, commit message format, and other standards, see the [top-level CONTRIBUTING.md](../../CONTRIBUTING.md).

This includes:

- Development workflow and branch naming
- Conventional commit format and types
- Code standards across the monorepo
- Testing requirements
- Pull request process

## Dependency Management

The monorepo uses a catalog system for dependencies. See the [top-level development guide](../../packages/electron-service/docs/development.md#dependency-management) for managing dependencies across packages.

## Debugging

### Enable Debug Logging

```bash
DEBUG=wdio-tauri-service:* npx wdio run wdio.conf.ts
```

### Debug Tests

```bash
# Run tests with Node inspector
node --inspect-brk node_modules/vitest/vitest.mjs run

# Then open chrome://inspect in Chrome
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Release Process

Releases are managed by maintainers. For detailed information about release management, versioning, and backporting, see:

- [Top-level Release Management](../../CONTRIBUTING.md#release-process)
- [Electron Service Release Management](../electron-service/docs/release-management.md)

## Getting Help

- **Questions**: Ask on [GitHub Discussions](https://github.com/webdriverio/desktop-mobile/discussions)
- **Bugs**: Report on [GitHub Issues](https://github.com/webdriverio/desktop-mobile/issues)
- **Help Wanted**: Look for [help wanted issues](https://github.com/webdriverio/desktop-mobile/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
- **Good First Issues**: [Perfect for getting started](https://github.com/webdriverio/desktop-mobile/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)

## Resources

- [WebdriverIO Documentation](https://webdriver.io)
- [Tauri Documentation](https://v2.tauri.app)
- [Tauri Plugin Development](https://v2.tauri.app/develop/plugins/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
