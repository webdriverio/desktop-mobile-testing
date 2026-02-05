# CrabNebula Integration Testing Strategy

## Overview

Testing the CrabNebula integration presents unique challenges due to the paid/subscription-based nature of their macOS WebDriver. This document outlines a comprehensive testing strategy that maximizes test coverage while minimizing dependency on the paid API key.

## Testing Pyramid

```
    /\
   /  \     E2E Tests (requires CN_API_KEY)
  /____\    - Run on CI with secret
  /    \
 /      \   Integration Tests (mocked)
/________\  - Driver detection
            - Process lifecycle
            - Configuration parsing
  /    \
 /      \   Unit Tests (no external deps)
/________\  - Pure functions
            - Validation logic
            - Type guards
```

## 1. Unit Tests (No External Dependencies)

These tests require no external services and can run on every PR.

### Driver Detection Logic
**File**: `packages/tauri-service/test/driverManager.spec.ts`

```typescript
describe('findCrabNebulaDriver', () => {
  it('should return path when driver exists in node_modules', () => {
    // Mock fs.existsSync to return true for expected path
    // Assert returned path matches
  });
  
  it('should return undefined when driver not found', () => {
    // Mock fs.existsSync to return false
    // Assert returns undefined
  });
  
  it('should check Windows path on win32', () => {
    // Mock process.platform = 'win32'
    // Assert checks .cmd extension
  });
});

describe('findTestRunnerBackend', () => {
  // Similar tests for backend detection
});
```

### Configuration Validation
**File**: `packages/tauri-service/test/crabnebulaConfig.spec.ts`

```typescript
describe('validateCrabNebulaConfig', () => {
  it('should pass with valid config', () => {
    const config = { driverProvider: 'crabnebula' };
    expect(() => validateConfig(config)).not.toThrow();
  });
  
  it('should throw when macOS without CN_API_KEY', () => {
    // Mock process.platform = 'darwin'
    delete process.env.CN_API_KEY;
    const config = { driverProvider: 'crabnebula' };
    expect(() => validateConfig(config)).toThrow('CN_API_KEY required');
  });
  
  it('should allow official driver without API key', () => {
    delete process.env.CN_API_KEY;
    const config = { driverProvider: 'official' };
    expect(() => validateConfig(config)).not.toThrow();
  });
});
```

### Platform Detection
**File**: `packages/tauri-service/test/platform.spec.ts`

```typescript
describe('isMacOSWithCrabNebula', () => {
  it('returns true only for darwin + crabnebula', () => {
    // Test matrix of platform + provider combinations
  });
});
```

## 2. Integration Tests (Mocked External Dependencies)

These tests mock the external processes but test the integration logic.

### Backend Process Lifecycle
**File**: `packages/tauri-service/test/crabnebulaBackend.spec.ts`

```typescript
describe('startTestRunnerBackend', () => {
  let mockSpawn: Mock;
  
  beforeEach(() => {
    // Mock child_process.spawn
    mockSpawn = vi.spyOn(child_process, 'spawn');
  });
  
  it('should spawn backend with correct env vars', async () => {
    process.env.CN_API_KEY = 'test-key';
    
    // Mock successful startup
    mockSpawn.mockReturnValue(createMockProcess());
    
    await startTestRunnerBackend(3000);
    
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.stringContaining('test-runner-backend'),
      [],
      expect.objectContaining({
        env: expect.objectContaining({
          CN_API_KEY: 'test-key',
          PORT: '3000',
        }),
      })
    );
  });
  
  it('should throw when CN_API_KEY missing', async () => {
    delete process.env.CN_API_KEY;
    
    await expect(startTestRunnerBackend(3000))
      .rejects.toThrow('CN_API_KEY required');
  });
  
  it('should detect ready state from stdout', async () => {
    const mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);
    
    const promise = startTestRunnerBackend(3000);
    
    // Simulate "listening" message on stdout
    mockProc.stdout.emit('data', 'Server listening on port 3000');
    
    await expect(promise).resolves.toBeDefined();
  });
  
  it('should handle startup timeout gracefully', async () => {
    vi.useFakeTimers();
    const mockProc = createMockProcess();
    mockSpawn.mockReturnValue(mockProc);
    
    const promise = startTestRunnerBackend(3000);
    
    // Fast-forward past timeout
    vi.advanceTimersByTime(15000);
    
    await expect(promise).resolves.toBeDefined();
    vi.useRealTimers();
  });
});

describe('stopTestRunnerBackend', () => {
  it('should send SIGTERM then SIGKILL if needed', async () => {
    const mockProc = createMockProcess();
    mockProc.killed = false;
    
    const stopPromise = stopTestRunnerBackend(mockProc);
    
    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    
    // Simulate non-responsive process
    vi.advanceTimersByTime(6000);
    expect(mockProc.kill).toHaveBeenCalledWith('SIGKILL');
    
    await stopPromise;
  });
});
```

### Launcher Integration
**File**: `packages/tauri-service/test/launcherCrabNebula.spec.ts`

```typescript
describe('TauriLaunchService with CrabNebula', () => {
  let launcher: TauriLaunchService;
  let mockBackend: { proc: ChildProcess; port: number };
  
  beforeEach(() => {
    // Mock all external dependencies
    vi.mocked(findCrabNebulaDriver).mockReturnValue('/mock/driver');
    vi.mocked(findTestRunnerBackend).mockReturnValue('/mock/backend');
  });
  
  it('should start backend on macOS with crabnebula provider', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CN_API_KEY = 'test-key';
    
    const service = new TauriLaunchService(
      { driverProvider: 'crabnebula' },
      capabilities,
      config
    );
    
    await service.onPrepare(config, capabilities);
    
    expect(startTestRunnerBackend).toHaveBeenCalled();
    expect(process.env.REMOTE_WEBDRIVER_URL).toBe('http://127.0.0.1:3000');
  });
  
  it('should not start backend on Linux even with crabnebula', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    
    const service = new TauriLaunchService(
      { driverProvider: 'crabnebula' },
      capabilities,
      config
    );
    
    await service.onPrepare(config, capabilities);
    
    expect(startTestRunnerBackend).not.toHaveBeenCalled();
  });
  
  it('should stop backend onComplete', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.CN_API_KEY = 'test-key';
    
    const service = new TauriLaunchService(
      { driverProvider: 'crabnebula' },
      capabilities,
      config
    );
    
    await service.onPrepare(config, capabilities);
    await service.onComplete(0, config, capabilities);
    
    expect(stopTestRunnerBackend).toHaveBeenCalled();
  });
});
```

## 3. E2E Tests (Requires CN_API_KEY)

These tests require a valid CrabNebula API key and run on a schedule or manual trigger.

### Test App Setup
**File**: `fixtures/crabnebula-test-app/`

Create a minimal Tauri app with:
1. `tauri-plugin-automation` installed
2. Simple UI for testing
3. Pre-built binaries for CI

### E2E Test Suite
**File**: `e2e/test/crabnebula/integration.spec.ts`

```typescript
describe('CrabNebula E2E', () => {
  beforeAll(async () => {
    // Skip if no API key
    if (!process.env.CN_API_KEY) {
      console.log('Skipping CrabNebula E2E - no CN_API_KEY');
      return;
    }
    
    // Initialize service
    browser = await init({
      browserName: 'tauri',
      'tauri:options': {
        application: './fixtures/crabnebula-test-app/src-tauri/target/debug/test-app',
      },
      'wdio:tauriServiceOptions': {
        driverProvider: 'crabnebula',
      },
    });
  });
  
  it('should start app on macOS', async () => {
    if (!process.env.CN_API_KEY) return;
    
    await expect(browser.$('body')).toExist();
  });
  
  it('should execute Tauri commands', async () => {
    if (!process.env.CN_API_KEY) return;
    
    const result = await browser.tauri.execute(({ core }) => {
      return core.invoke('test_command');
    });
    
    expect(result).toBeDefined();
  });
  
  it('should capture logs', async () => {
    if (!process.env.CN_API_KEY) return;
    
    // Trigger log output
    await browser.execute(() => console.log('test message'));
    
    // Verify log capture (implementation depends on log forwarding)
  });
});
```

## 4. CI/CD Configuration

### GitHub Actions Strategy

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  # Run on every PR - no API key needed
  unit-and-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      
      - name: Install dependencies
        run: npm install
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration

  # Run on every PR for Windows/Linux (official driver)
  e2e-standard:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-action@stable
      
      - name: Install dependencies
        run: npm install
      
      - name: Build test app
        run: npm run build:test-app
      
      - name: Run E2E tests
        run: npm run test:e2e

  # Run only when CN_API_KEY is available
  e2e-crabnebula-macos:
    runs-on: macos-latest
    if: secrets.CN_API_KEY != ''
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-action@stable
      
      - name: Install dependencies
        run: |
          npm install
          npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
      
      - name: Build test app
        run: npm run build:test-app
      
      - name: Run CrabNebula E2E tests
        env:
          CN_API_KEY: ${{ secrets.CN_API_KEY }}
        run: npm run test:e2e:crabnebula

  # Scheduled run (weekly) to catch regressions
  e2e-crabnebula-scheduled:
    runs-on: macos-latest
    if: secrets.CN_API_KEY != ''
    schedule:
      - cron: '0 0 * * 0'  # Weekly on Sunday
    steps:
      # Same as e2e-crabnebula-macos
```

## 5. Manual Testing Checklist

For developers without CN_API_KEY:

### Without API Key (Local Development)
- [ ] Unit tests pass
- [ ] Integration tests pass (with mocks)
- [ ] Windows/Linux E2E tests pass
- [ ] Code review by maintainer with API key

### With API Key (Maintainer)
- [ ] macOS E2E tests pass
- [ ] Backend process starts/stops correctly
- [ ] Log capture works
- [ ] Error messages are helpful
- [ ] Documentation is accurate

## 6. Test Data Management

### Mock Fixtures
**Directory**: `packages/tauri-service/test/fixtures/`

```
fixtures/
├── mock-crabnebula-driver/
│   └── tauri-driver  # Shell script that simulates driver
├── mock-test-runner-backend/
│   └── test-runner-backend  # Shell script that simulates backend
└── mock-tauri-app/
    ├── Cargo.toml    # With tauri-plugin-automation
    └── src/
        └── main.rs
```

### Mock Driver Script
```bash
#!/bin/bash
# mock-tauri-driver

# Simulate startup delay
sleep 0.5

# Output expected startup message
echo "tauri-driver started on port $2"

# Keep running
while true; do
  sleep 1
done
```

## 7. Obtaining Test Access

### Option 1: OSS License Request
Contact CrabNebula support:
- Explain the project (WebdriverIO Tauri Service)
- Request OSS license for CI testing
- Most companies provide free licenses for open source projects

### Option 2: Sponsored Testing
- Add CrabNebula as a sponsor/partner
- Display logo in README
- Mention in documentation

### Option 3: Manual QA Process
- Core maintainers test macOS manually before releases
- Community contributors test with their own API keys
- Rely on Windows/Linux for CI coverage

## 8. Test Coverage Goals

| Layer | Target Coverage | Requires API Key |
|-------|-----------------|------------------|
| Unit Tests | 90%+ | No |
| Integration Tests | 80%+ | No |
| E2E (Windows/Linux) | 100% of features | No |
| E2E (macOS) | Core scenarios only | Yes |

## 9. Debugging Failed Tests

### Common Issues

**"CN_API_KEY invalid"**
- Check key hasn't expired
- Verify key is for correct environment (prod vs staging)

**"test-runner-backend connection refused"**
- Check port 3000 is available
- Verify backend process started
- Check firewall settings

**"tauri-plugin-automation not found"**
- Verify plugin is in Cargo.toml
- Check app was built in debug mode
- Confirm conditional compilation is correct

### Debug Mode
```typescript
services: [['@wdio/tauri-service', {
  driverProvider: 'crabnebula',
  logLevel: 'debug',
  captureBackendLogs: true,
}]]
```

## Summary

The testing strategy balances:
- **Comprehensive coverage** through unit/integration tests (no API key needed)
- **Real validation** through scheduled E2E tests (requires API key)
- **Contributor accessibility** - anyone can run most tests
- **Quality assurance** - maintainers verify macOS before releases

With proper mocking, 80%+ of the integration can be tested without the paid API key, making the project accessible to contributors while ensuring quality through maintainer testing.