# CrabNebula Integration Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for adding CrabNebula tauri-driver support to `@wdio/tauri-service`.

## Phase 1: Foundation (Week 1)

### Task 1.1: Update Type Definitions
**File**: [`packages/native-types/src/tauri.ts`](packages/native-types/src/tauri.ts:139)

Add new configuration options:

```typescript
export interface TauriServiceOptions {
  // ... existing options ...
  
  /**
   * Driver provider to use for WebDriver communication
   * - 'official': Use cargo-installed tauri-driver (default)
   * - 'crabnebula': Use @crabnebula/tauri-driver from npm
   * @default 'official'
   */
  driverProvider?: 'official' | 'crabnebula';
  
  /**
   * Path to @crabnebula/tauri-driver executable
   * If not provided, will be auto-detected from node_modules
   */
  crabnebulaDriverPath?: string;
  
  /**
   * Auto-manage test-runner-backend process (macOS only)
   * Required for macOS testing with CrabNebula
   * @default true when driverProvider is 'crabnebula' and platform is darwin
   */
  crabnebulaManageBackend?: boolean;
  
  /**
   * Port for test-runner-backend (macOS only)
   * @default 3000
   */
  crabnebulaBackendPort?: number;
}
```

### Task 1.2: Update Driver Manager
**File**: [`packages/tauri-service/src/driverManager.ts`](packages/tauri-service/src/driverManager.ts:1)

Add CrabNebula driver detection:

```typescript
/**
 * Find @crabnebula/tauri-driver in node_modules
 */
export function findCrabNebulaDriver(): string | undefined {
  // Check local node_modules
  const localPaths = [
    join(process.cwd(), 'node_modules', '.bin', 'tauri-driver'),
    join(process.cwd(), 'node_modules', '.bin', 'tauri-driver.cmd'), // Windows
    join(process.cwd(), 'node_modules', '@crabnebula', 'tauri-driver', 'bin', 'tauri-driver'),
  ];
  
  for (const path of localPaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  // Try to resolve via require.resolve
  try {
    const pkgPath = require.resolve('@crabnebula/tauri-driver/package.json');
    const binPath = join(dirname(pkgPath), 'bin', 'tauri-driver');
    if (existsSync(binPath)) {
      return binPath;
    }
  } catch {
    // Package not found
  }
  
  return undefined;
}

/**
 * Check if test-runner-backend is available
 */
export function findTestRunnerBackend(): string | undefined {
  const paths = [
    join(process.cwd(), 'node_modules', '.bin', 'test-runner-backend'),
    join(process.cwd(), 'node_modules', '.bin', 'test-runner-backend.cmd'),
    join(process.cwd(), 'node_modules', '@crabnebula', 'test-runner-backend', 'bin', 'test-runner-backend'),
  ];
  
  for (const path of paths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  try {
    const pkgPath = require.resolve('@crabnebula/test-runner-backend/package.json');
    const binPath = join(dirname(pkgPath), 'bin', 'test-runner-backend');
    if (existsSync(binPath)) {
      return binPath;
    }
  } catch {
    // Package not found
  }
  
  return undefined;
}
```

Update `ensureTauriDriver` to support provider selection:

```typescript
export async function ensureTauriDriver(options: TauriServiceOptions): Promise<DriverInstallResult> {
  const provider = options.driverProvider ?? 'official';
  
  if (provider === 'crabnebula') {
    // Check for explicit path
    if (options.crabnebulaDriverPath) {
      if (existsSync(options.crabnebulaDriverPath)) {
        return {
          success: true,
          path: options.crabnebulaDriverPath,
          method: 'found',
        };
      }
      return {
        success: false,
        path: options.crabnebulaDriverPath,
        method: 'found',
        error: `CrabNebula driver not found at: ${options.crabnebulaDriverPath}`,
      };
    }
    
    // Auto-detect from node_modules
    const detectedPath = findCrabNebulaDriver();
    if (detectedPath) {
      return {
        success: true,
        path: detectedPath,
        method: 'found',
      };
    }
    
    return {
      success: false,
      path: '',
      method: 'found',
      error: '@crabnebula/tauri-driver not found. Install with: npm install -D @crabnebula/tauri-driver',
    };
  }
  
  // Existing official driver logic...
}
```

### Task 1.3: Create CrabNebula Backend Manager
**New File**: `packages/tauri-service/src/crabnebulaBackend.ts`

```typescript
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createLogger } from '@wdio/native-utils';
import { findTestRunnerBackend } from './driverManager.js';

const log = createLogger('tauri-service', 'crabnebula');

export interface BackendProcessInfo {
  proc: ChildProcess;
  port: number;
}

/**
 * Start the CrabNebula test-runner-backend process
 * Required for macOS testing
 */
export async function startTestRunnerBackend(port: number = 3000): Promise<BackendProcessInfo> {
  const backendPath = findTestRunnerBackend();
  
  if (!backendPath) {
    throw new Error(
      'test-runner-backend not found. Install with: npm install -D @crabnebula/test-runner-backend'
    );
  }
  
  // Validate CN_API_KEY
  if (!process.env.CN_API_KEY) {
    throw new Error(
      'CN_API_KEY environment variable is required for CrabNebula macOS testing. ' +
      'Contact CrabNebula to obtain an API key.'
    );
  }
  
  log.info(`Starting test-runner-backend on port ${port}`);
  
  return new Promise((resolve, reject) => {
    const proc = spawn(backendPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });
    
    let isReady = false;
    
    // Handle stdout
    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout });
      rl.on('line', (line) => {
        log.debug(`[test-runner-backend] ${line}`);
        
        // Detect ready state (adjust based on actual backend output)
        if (line.includes('listening') || line.includes('ready')) {
          isReady = true;
          resolve({ proc, port });
        }
      });
    }
    
    // Handle stderr
    if (proc.stderr) {
      const rl = createInterface({ input: proc.stderr });
      rl.on('line', (line) => {
        log.error(`[test-runner-backend] ${line}`);
      });
    }
    
    proc.on('error', (error) => {
      reject(new Error(`Failed to start test-runner-backend: ${error.message}`));
    });
    
    proc.on('exit', (code) => {
      if (!isReady && code !== 0) {
        reject(new Error(`test-runner-backend exited with code ${code}`));
      }
    });
    
    // Timeout fallback
    setTimeout(() => {
      if (!isReady) {
        log.warn('test-runner-backend startup timeout, assuming ready');
        resolve({ proc, port });
      }
    }, 10000);
  });
}

/**
 * Wait for test-runner-backend to be ready
 */
export async function waitTestRunnerBackendReady(port: number = 3000, timeoutMs: number = 30000): Promise<void> {
  const http = await import('node:http');
  const started = Date.now();
  
  while (Date.now() - started < timeoutMs) {
    const isReady = await new Promise<boolean>((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 1000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
    
    if (isReady) {
      log.debug(`test-runner-backend ready on port ${port}`);
      return;
    }
    
    await new Promise((r) => setTimeout(r, 250));
  }
  
  throw new Error(`test-runner-backend did not become ready within ${timeoutMs}ms`);
}

/**
 * Stop the test-runner-backend process
 */
export async function stopTestRunnerBackend(proc: ChildProcess): Promise<void> {
  if (proc.killed) {
    return;
  }
  
  log.info('Stopping test-runner-backend');
  proc.kill('SIGTERM');
  
  // Wait for graceful shutdown
  await new Promise<void>((resolve) => {
    proc.on('exit', () => resolve());
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);
  });
}
```

### Task 1.4: Update Launcher for macOS Support
**File**: [`packages/tauri-service/src/launcher.ts`](packages/tauri-service/src/launcher.ts:173)

Modify platform check to allow CrabNebula on macOS:

```typescript
async onPrepare(
  _config: Options.Testrunner,
  capabilities: TauriCapabilities[] | Record<string, { capabilities: TauriCapabilities }>,
): Promise<void> {
  // ... existing code ...
  
  // Determine if using CrabNebula provider
  const firstCap = Array.isArray(capabilities) 
    ? capabilities[0] 
    : Object.values(capabilities)[0]?.capabilities;
  const options = mergeOptions(this.options, firstCap?.['wdio:tauriServiceOptions']);
  const isCrabNebula = options.driverProvider === 'crabnebula';
  
  // Check for unsupported platforms
  if (process.platform === 'darwin' && !isCrabNebula) {
    const errorMessage =
      'Tauri testing on macOS requires CrabNebula driver. ' +
      'Set driverProvider: "crabnebula" in your service options, or ' +
      'run tests on Windows or Linux. ' +
      'See: https://docs.crabnebula.dev/tauri/webdriver/';
    log.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  // For CrabNebula on macOS, validate prerequisites
  if (process.platform === 'darwin' && isCrabNebula) {
    await this.validateCrabNebulaPrerequisites(options);
  }
  
  // ... rest of existing code ...
}

/**
 * Validate CrabNebula prerequisites for macOS
 */
private async validateCrabNebulaPrerequisites(options: TauriServiceOptions): Promise<void> {
  // Check CN_API_KEY
  if (!process.env.CN_API_KEY) {
    throw new Error(
      'CN_API_KEY environment variable is required for CrabNebula macOS testing. ' +
      'Contact CrabNebula (https://crabnebula.dev) to obtain an API key.'
    );
  }
  
  // Check for test-runner-backend if auto-management is enabled
  const manageBackend = options.crabnebulaManageBackend ?? true;
  if (manageBackend) {
    const backendPath = findTestRunnerBackend();
    if (!backendPath) {
      throw new Error(
        '@crabnebula/test-runner-backend not found. ' +
        'Install with: npm install -D @crabnebula/test-runner-backend'
      );
    }
  }
  
  log.info('✅ CrabNebula prerequisites validated');
}
```

## Phase 2: Backend Integration (Week 1-2)

### Task 2.1: Integrate Backend Lifecycle
**File**: [`packages/tauri-service/src/launcher.ts`](packages/tauri-service/src/launcher.ts:118)

Add backend process management to launcher:

```typescript
export default class TauriLaunchService {
  private tauriDriverProcess?: ChildProcess;
  private testRunnerBackend?: ChildProcess; // NEW
  private backendPort?: number; // NEW
  // ... existing properties ...

  async onPrepare(/* ... */): Promise<void> {
    // ... existing code ...
    
    // Start test-runner-backend for CrabNebula on macOS
    if (process.platform === 'darwin' && isCrabNebula) {
      const manageBackend = options.crabnebulaManageBackend ?? true;
      if (manageBackend) {
        const backendPort = options.crabnebulaBackendPort ?? 3000;
        const { proc } = await startTestRunnerBackend(backendPort);
        await waitTestRunnerBackendReady(backendPort);
        
        this.testRunnerBackend = proc;
        this.backendPort = backendPort;
        
        // Set environment variable for tauri-driver
        process.env.REMOTE_WEBDRIVER_URL = `http://127.0.0.1:${backendPort}`;
      }
    }
    
    // ... rest of existing code ...
  }
  
  async onComplete(/* ... */): Promise<void> {
    // ... existing code ...
    
    // Stop test-runner-backend
    if (this.testRunnerBackend) {
      await stopTestRunnerBackend(this.testRunnerBackend);
      this.testRunnerBackend = undefined;
    }
    
    // ... rest of existing code ...
  }
}
```

### Task 2.2: Update Worker Start for Backend
**File**: [`packages/tauri-service/src/launcher.ts`](packages/tauri-service/src/launcher.ts:377)

Ensure REMOTE_WEBDRIVER_URL is available in worker processes:

```typescript
async onWorkerStart(cid: string, caps: /* ... */): Promise<void> {
  // ... existing code ...
  
  // For CrabNebula on macOS, ensure environment is set
  if (process.platform === 'darwin') {
    const options = mergeOptions(this.options, firstCap?.['wdio:tauriServiceOptions']);
    if (options.driverProvider === 'crabnebula' && this.backendPort) {
      process.env.REMOTE_WEBDRIVER_URL = `http://127.0.0.1:${this.backendPort}`;
    }
  }
  
  // ... rest of existing code ...
}
```

## Phase 3: Developer Experience (Week 2)

### Task 3.1: Add Plugin Validation Helper
**New File**: `packages/tauri-service/src/pluginValidator.ts`

```typescript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'validator');

/**
 * Check if tauri-plugin-automation is likely installed
 * This is a best-effort check - the plugin may still be missing
 */
export function checkAutomationPlugin(srcTauriPath: string): { installed: boolean; message: string } {
  // Check Cargo.toml for plugin dependency
  const cargoPath = join(srcTauriPath, 'Cargo.toml');
  try {
    const cargoContent = readFileSync(cargoPath, 'utf8');
    
    if (cargoContent.includes('tauri-plugin-automation')) {
      return {
        installed: true,
        message: 'tauri-plugin-automation found in Cargo.toml',
      };
    }
    
    return {
      installed: false,
      message: 
        'tauri-plugin-automation not found in Cargo.toml. ' +
        'Add it with: cargo add tauri-plugin-automation --dev ' +
        'See: https://docs.crabnebula.dev/tauri/webdriver/',
    };
  } catch (error) {
    return {
      installed: false,
      message: `Could not read Cargo.toml: ${error instanceof Error ? error.message : error}`,
    };
  }
}

/**
 * Warn about plugin requirements for macOS
 */
export function warnAutomationPlugin(srcTauriPath: string): void {
  const result = checkAutomationPlugin(srcTauriPath);
  if (!result.installed) {
    log.warn(`⚠️  ${result.message}`);
  }
}
```

### Task 3.2: Update Documentation
**Files**:
- [`packages/tauri-service/docs/platform-support.md`](packages/tauri-service/docs/platform-support.md:279)
- [`packages/tauri-service/docs/configuration.md`](packages/tauri-service/docs/configuration.md:1)
- New: `packages/tauri-service/docs/crabnebula-setup.md`

### Task 3.3: Add Example Configuration
**New File**: `examples/crabnebula-wdio.conf.ts`

```typescript
import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  
  services: [
    ['@wdio/tauri-service', {
      driverProvider: 'crabnebula',
      crabnebulaManageBackend: true,
      captureBackendLogs: true,
      captureFrontendLogs: true,
    }]
  ],
  
  capabilities: [{
    browserName: 'tauri',
    'tauri:options': {
      application: './src-tauri/target/debug/my-app',
    },
  }],
  
  specs: ['./test/specs/**/*.ts'],
  framework: 'mocha',
};
```

## Phase 4: Testing & Validation (Week 2-3)

### Task 4.1: Unit Tests
**New File**: `packages/tauri-service/test/crabnebulaBackend.spec.ts`

- Mock test-runner-backend process
- Test start/stop lifecycle
- Test validation functions

### Task 4.2: Integration Tests
**New File**: `e2e/test/crabnebula/validation.spec.ts`

- Test driver detection
- Test configuration parsing
- Test error messages

### Task 4.3: CI/CD Setup
**File**: `.github/workflows/crabnebula-test.yml`

```yaml
name: CrabNebula Integration Tests

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly
  workflow_dispatch:

jobs:
  test-macos:
    runs-on: macos-latest
    if: secrets.CN_API_KEY != ''
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-action@stable
      
      - name: Install dependencies
        run: |
          npm install
          npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
      
      - name: Build test app
        run: npm run tauri build -- --debug
        working-directory: ./fixtures/test-app
      
      - name: Run tests
        env:
          CN_API_KEY: ${{ secrets.CN_API_KEY }}
        run: npm run test:crabnebula
```

## Migration Path for Users

### Current Users (Official Driver)
No changes required - official driver remains default.

### New macOS Users
1. Obtain CN_API_KEY from CrabNebula
2. Install packages:
   ```bash
   npm install -D @crabnebula/tauri-driver @crabnebula/test-runner-backend
   ```
3. Add plugin to Tauri app:
   ```bash
   cd src-tauri && cargo add tauri-plugin-automation
   ```
4. Update wdio.conf.ts:
   ```typescript
   services: [['@wdio/tauri-service', {
     driverProvider: 'crabnebula',
   }]]
   ```

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OSS license not obtained | Medium | High | Document manual testing process |
| Plugin validation false positives | Low | Medium | Clear error messages, documentation |
| Backend process instability | Low | High | Robust error handling, timeouts |
| Breaking changes in CrabNebula API | Low | Medium | Version pinning, abstraction layer |

## Success Criteria

- [ ] macOS tests run successfully with CrabNebula driver
- [ ] Windows/Linux continue to work with official driver
- [ ] All existing tests pass
- [ ] Documentation is complete
- [ ] CI passes (with or without CN_API_KEY)
