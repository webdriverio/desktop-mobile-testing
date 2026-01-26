# Contributing to WebdriverIO Desktop & Mobile Testing Services

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to create a welcoming environment for all contributors.

## Getting Started

### Prerequisites

- Node.js 18 LTS or 20 LTS
- pnpm 10.12.0+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/desktop-mobile.git
   cd desktop-mobile
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Build all packages:
   ```bash
   pnpm turbo build
   ```
5. Run tests to verify setup:
   ```bash
   pnpm test
   ```

See [docs/setup.md](docs/setup.md) for detailed setup instructions.

## Development Workflow

### 1. Create a Branch

Create a new branch for your changes:

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bugfix
```

Branch naming conventions:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Build/tooling changes

### 2. Make Your Changes

- Write code following our [coding standards](#coding-standards)
- Add tests for new functionality
- Update documentation as needed
- Ensure tests pass: `pnpm test`
- Ensure linting passes: `pnpm lint`

### 3. Commit Your Changes

We use conventional commits for clear commit history:

```bash
git add .
git commit -m "feat: add new feature"
```

Commit message format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or tooling changes
- `perf`: Performance improvements

Example:

```bash
git commit -m "feat(electron): add window management support"
git commit -m "fix(flutter): resolve binary detection on Windows"
git commit -m "docs: update installation instructions"
```

### 4. Push and Create Pull Request

```bash
git push origin feature/my-feature
```

Then create a pull request on GitHub with:

- Clear title describing the change
- Description of what changed and why
- Reference to any related issues
- Screenshots (if applicable)

## Coding Standards

### TypeScript

- Use **TypeScript strict mode**
- Prefer `undefined` over `null`
- Use **ESM** (ES Modules) everywhere
- Avoid `any` - use proper types
- Document public APIs with JSDoc comments

Example:

```typescript
/**
 * Detect the binary path for an Electron application
 * @param options - Detection options
 * @returns Path to the binary
 * @throws {Error} If binary cannot be found
 */
export async function detectBinary(options: BinaryOptions): Promise<string> {
  // Implementation
}
```

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Use **trailing commas** in objects and arrays
- Max line length: **120 characters**
- Use **arrow functions** for callbacks

Our linters (Biome and ESLint) will auto-fix most style issues:

```bash
pnpm lint:fix
pnpm format
```

### Project Structure

- No **barrel files** (`index.ts` with only re-exports) except in package roots
- Avoid **nested ternaries** - extract logic for readability
- Use meaningful names for files and directories
- Keep files focused - one main export per file

## Testing

### Test Requirements

- All code must have **80%+ test coverage**
- Write tests for:
  - New features
  - Bug fixes
  - Edge cases
  - Error handling

### Writing Tests

We use **Vitest** for testing:

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('MyFeature', () => {
  it('should do something', () => {
    expect(doSomething()).toBe(expected);
  });

  it('should handle errors', () => {
    expect(() => doSomethingBad()).toThrow('Error message');
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @wdio/electron-service test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm --filter @wdio/electron-service vitest
```

## Documentation

### Code Documentation

- Add JSDoc comments to all public APIs
- Include `@param`, `@returns`, `@throws` where applicable
- Provide usage examples in comments

### README Files

- Each package must have a comprehensive README
- Include installation, usage, API docs, and examples
- Keep READMEs up to date with code changes

### Documentation Files

- Update `docs/` when adding new features
- Add examples to `examples/` directory
- Update CHANGELOG.md for notable changes

## Pull Request Process

### Before Submitting

Ensure your PR passes all checks:

```bash
# Build all packages
pnpm turbo build

# Run linting
pnpm lint

# Run type checking
pnpm typecheck

# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### PR Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated and passing
- [ ] Test coverage ≥ 80%
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] All CI checks passing

### Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, a maintainer will merge

## Package-Specific Guidelines

### Electron Service

When contributing to the Electron service:

- Maintain backward compatibility
- Test on Windows, macOS, and Linux
- Test with both Electron Forge and Builder
- Test with ESM and CJS configurations

### Tauri Service

When contributing to the Tauri service:

- Maintain backward compatibility with tauri-driver
- Test on Windows, macOS, and Linux
- Test with multiremote configurations
- Ensure plugin communication works correctly
- Test with various Tauri configuration patterns

### Future Services (Planned)

Flutter, React Native, and Neutralino services are planned but not yet implemented. When these services are added, specific contribution guidelines will be provided.

### Shared Utilities

When contributing to shared utilities:

- Keep utilities framework-agnostic
- Document extension points clearly
- Consider impact on all services

## Maintenance Policy

This repository does not maintain LTS or backport branches. Only the latest version on `main` receives updates. For details, see [MAINTENANCE.md](./MAINTENANCE.md).

## Release Process

Maintainers handle releases. The process is:

1. Update version numbers
2. Update CHANGELOG.md
3. Create git tag
4. Publish to npm

## Getting Help

- **Questions**: Ask on [GitHub Discussions](https://github.com/webdriverio/desktop-mobile/discussions)
- **Bugs**: Report on [GitHub Issues](https://github.com/webdriverio/desktop-mobile/issues)
- **Discord**: Join the [WebdriverIO Discord](https://discord.webdriver.io) for real-time support

## Recognition

Contributors will be:

- Credited in CHANGELOG.md
- Listed in package.json contributors
- Recognized in release notes

Thank you for contributing! 🎉


