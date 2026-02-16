# E2E Testing Guide

This guide covers end-to-end testing for the WebdriverIO Desktop & Mobile services.

## Overview

E2E tests verify the complete integration of WDIO services with real applications. They run against built applications in `fixtures/e2e-apps/` using WebdriverIO's test runner.

## Test Organization

```
e2e/
├── test/
│   ├── electron/           # Electron E2E tests
│   │   ├── api.spec.ts
│   │   ├── dialog.spec.ts
│   │   ├── mock.spec.ts
│   │   └── ...
│   └── tauri/              # Tauri E2E tests
│       ├── api.spec.ts
│       ├── logging.spec.ts
│       └── ...
├── lib/                    # Shared test utilities
├── config/                 # Test configurations
├── wdio.electron.conf.ts   # Electron WDIO config
└── wdio.tauri.conf.ts      # Tauri WDIO config

fixtures/e2e-apps/
├── electron-builder/       # Electron app (builder packaging)
├── electron-forge/         # Electron app (forge packaging)
├── electron-script/        # Electron app (script mode)
└── tauri/                  # Tauri app
```

## Running E2E Tests

### Prerequisites

1. **Build the apps first:**
   ```bash
   # Build all E2E apps
   pnpm turbo build --filter electron-builder-e2e-app
   pnpm turbo build --filter electron-forge-e2e-app
   pnpm turbo build --filter tauri-e2e-app
   ```

2. **Build the services:**
   ```bash
   pnpm build
   ```

3. **Platform-specific requirements:**
   - **Windows**: No special requirements
   - **macOS**: May need to allow app execution in Security settings
   - **Linux**: May need to install `webkit2gtk-driver` for Tauri

### Running Tests

```bash
# Electron tests (builder packaging)
pnpm --filter @repo/e2e test:e2e:electron-builder

# Electron tests (forge packaging)
pnpm --filter @repo/e2e test:e2e:electron-forge

# Electron tests (script mode)
pnpm --filter @repo/e2e test:e2e:electron-script

# Tauri tests
pnpm --filter @repo/e2e test:e2e:tauri-basic

# Tauri specific modes
pnpm --filter @repo/e2e test:e2e:tauri-basic:window
pnpm --filter @repo/e2e test:e2e:tauri-basic:multiremote
pnpm --filter @repo/e2e test:e2e:tauri-basic:standalone
```

## Configuration

### Electron Configuration (`wdio.electron.conf.ts`)

```typescript
export const config: WebdriverIO.Config = {
  services: [
    [
      'electron',
      {
        appBinaryPath: './path/to/app',
        appArgs: ['--arg1', '--arg2'],
      },
    ],
  ],
  // ...
};
```

### Tauri Configuration (`wdio.tauri.conf.ts`)

```typescript
export const config: WebdriverIO.Config = {
  services: [
    [
      'tauri',
      {
        application: '/path/to/app/binary',
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    ],
  ],
  // ...
};
```

## Test Modes

### Single Browser

Default mode - single browser instance:

```typescript
capabilities: [
  {
    browserName: 'tauri',
    'tauri:options': {
      application: appBinaryPath,
    },
  },
];
```

### Multiremote

Multiple browser instances simultaneously:

```typescript
capabilities: {
  browserA: {
    browserName: 'tauri',
    'tauri:options': { application: appBinaryPath },
  },
  browserB: {
    browserName: 'tauri',
    'tauri:options': { application: appBinaryPath },
  },
};
```

### Per-Worker

Separate driver instance per test worker:

```typescript
capabilities: [
  {
    browserName: 'tauri',
    'tauri:options': {
      application: appBinaryPath,
    },
    'wdio:maxInstances': 3,
  },
];
```

## Test Patterns

### Basic Test

```typescript
describe('My App', () => {
  it('should display the correct title', async () => {
    const title = await browser.getTitle();
    expect(title).toBe('Expected Title');
  });
});
```

### API Mocking (Electron)

```typescript
describe('API Mocking', () => {
  it('should mock API responses', async () => {
    const mock = await browser.mock('**/api/users');
    mock.respond([{ id: 1, name: 'Test' }]);

    // Trigger API call in app
    await $('button.fetch-users').click();

    // Verify mocked response was used
    expect(mock.calls.length).toBe(1);
  });
});
```

### Tauri Backend Invocation

```typescript
describe('Backend Commands', () => {
  it('should invoke backend commands', async () => {
    const result = await browser.invoke('my_backend_command', {
      arg1: 'value',
    });
    expect(result).toBe('expected result');
  });
});
```

### Log Capture

```typescript
describe('Log Capture', () => {
  it('should capture backend logs', async () => {
    // Enable log capture in config
    // Logs appear in WDIO output with [BACKEND] prefix

    await browser.invoke('generate_logs');

    // Check WDIO logs for captured output
  });
});
```

## Debugging E2E Tests

### Enable Debug Logging

```bash
DEBUG=tauri-service:* pnpm test:e2e:tauri-basic
```

### Run Specific Test

```bash
pnpm wdio wdio.tauri.conf.ts --spec test/tauri/api.spec.ts
```

### Headed Mode (see browser)

For Electron, the app window is visible by default. For Tauri window mode:

```typescript
// In wdio config
capabilities: [
  {
    browserName: 'tauri',
    'tauri:options': {
      application: appBinaryPath,
      window: true, // Opens visible window
    },
  },
];
```

### Common Issues

#### Port Conflicts

If tests hang, check for port conflicts:

```bash
# Check what's using the default port
lsof -i :4444

# Kill stale processes
kill -9 <PID>
```

#### App Not Found

Ensure app is built and path is correct:

```bash
ls -la fixtures/e2e-apps/tauri/src-tauri/target/release/
```

#### Protocol Handler Not Registered

For Tauri deep link tests, the protocol handler must be registered. Setup scripts are provided per app:

```bash
# From root - protocol install runs automatically before E2E tests
pnpm e2e:tauri-basic
pnpm e2e:electron-builder

# Run protocol install only
pnpm protocol-install:tauri
pnpm protocol-install:electron-builder
```

Each app has platform-specific setup scripts in `fixtures/e2e-apps/<app>/scripts/` that detect the OS and register the protocol handler. These scripts are idempotent — running them multiple times is safe as they check if the protocol is already registered and skip if so.

## CI Integration

### GitHub Actions

E2E tests run in CI with matrix configuration:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    include:
      - os: macos-latest
        arch: x64
      - os: macos-latest
        arch: arm64
```

### Platform-Specific Notes

| Platform | Notes |
|----------|-------|
| Windows | Requires `.cmd` for scripts, Edge driver for WebView2 |
| macOS | Universal builds tested separately, may need security overrides |
| Linux | Requires `webkit2gtk-driver` for Tauri |

## Adding New E2E Tests

1. **Create test file** in `e2e/test/<framework>/`
2. **Add test utilities** in `e2e/lib/` if needed
3. **Update configuration** if new capabilities needed
4. **Add to CI** in `.github/workflows/ci.yml`
5. **Document** in this file

## Best Practices

1. **Isolate tests** - Each test should be independent
2. **Clean up state** - Reset app state between tests
3. **Use meaningful selectors** - Prefer `data-testid` attributes
4. **Avoid flaky patterns** - Use explicit waits, not fixed timeouts
5. **Log strategically** - Add context for debugging, but avoid spam
6. **Test user flows** - Focus on real user interactions, not implementation details
