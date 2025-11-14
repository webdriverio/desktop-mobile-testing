# Plan: Electron Log Forwarding Implementation

**Date:** 2025-01-XX
**Status:** Draft
**Priority:** High

## Overview

Implement log forwarding for Electron applications, similar to the Tauri service implementation. This will capture and forward logs from both the Electron main process and renderer process to WebDriverIO's logger system, allowing seamless integration of Electron application logs with test output.

## Goals

1. **Main Process Log Capture** - Capture console logs from the Electron main process via CDP `Runtime.consoleAPICalled` events
2. **Renderer Process Log Capture** - Capture console logs from renderer processes via CDP `Runtime.consoleAPICalled` events and patching `browser.execute()`
3. **Reuse Tauri Infrastructure** - Leverage existing `logForwarder.ts` and `logParser.ts` patterns from Tauri service
4. **Independent Configuration** - Allow separate configuration for main and renderer log capture
5. **Log Level Filtering** - Support log level filtering for both main and renderer processes

## Architecture

### Current State
- Electron service uses CDP bridge for main process communication
- No log capture currently implemented
- Renderer logs are not accessible via CDP by default

### New Flow
```
CDP Bridge → Runtime.consoleAPICalled events → Filter by execution context → Parse → Forward to WDIO logger
Renderer → browser.execute() patching → Forward console logs → Parse → Forward to WDIO logger
```

## Implementation Details

### 1. Reuse Tauri Log Infrastructure

**Files to reuse:**
- `packages/tauri-service/src/logForwarder.ts` - Copy to `packages/electron-service/src/logForwarder.ts`
- `packages/tauri-service/src/logParser.ts` - Adapt for Electron (different log patterns)

**Adaptations needed:**
- Update `formatLogMessage()` to use `[Electron:Main]` and `[Electron:Renderer]` prefixes
- Update log parser patterns for Electron console output (different from Rust/Tauri)
- Remove Tauri-specific patterns (tauri-driver, etc.)

### 2. New Type Definitions

**File: `packages/native-types/src/index.ts`**

Add to `ElectronServiceOptions`:
```typescript
/**
 * Enable/disable capturing main process logs from CDP
 * @default false
 */
captureMainLogs?: boolean;

/**
 * Enable/disable capturing renderer process logs from CDP and browser.execute()
 * @default false
 */
captureRendererLogs?: boolean;

/**
 * Minimum log level for main process logs (only logs at this level and above will be captured)
 * @default 'info'
 */
mainLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimum log level for renderer process logs (only logs at this level and above will be captured)
 * @default 'info'
 */
rendererLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
```

Add to `ElectronServiceGlobalOptions`:
```typescript
/**
 * Enable/disable capturing main process logs from CDP
 * @default false
 */
captureMainLogs?: boolean;

/**
 * Enable/disable capturing renderer process logs from CDP and browser.execute()
 * @default false
 */
captureRendererLogs?: boolean;

/**
 * Minimum log level for main process logs
 * @default 'info'
 */
mainLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Minimum log level for renderer process logs
 * @default 'info'
 */
rendererLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
```

### 3. Update CDP Bridge

**File: `packages/electron-service/src/bridge.ts`**

Add log capture setup:
```typescript
export class ElectronCdpBridge extends CdpBridge {
  #contextId: number = 0;
  #logCaptureEnabled: boolean = false;
  #mainLogLevel: LogLevel = 'info';
  #rendererLogLevel: LogLevel = 'info';
  #instanceId?: string; // For multiremote support

  async connect(instanceId?: string): Promise<void> {
    // ... existing connection code ...

    // Store instance ID for multiremote log prefixes
    this.#instanceId = instanceId;

    // Setup log capture if enabled
    if (this.#logCaptureEnabled) {
      await this.setupLogCapture();
    }
  }

  private async setupLogCapture(): Promise<void> {
    // Enable Runtime domain for console events
    await this.send('Runtime.enable');

    // Listen for console API calls
    this.on('Runtime.consoleAPICalled', (params) => {
      this.handleConsoleEvent(params);
    });
  }

  private handleConsoleEvent(params: Runtime.ConsoleAPICalledEvent): void {
    // Determine if this is main process or renderer process
    const isMainProcess = params.executionContextId === this.#contextId;
    const source = isMainProcess ? 'main' : 'renderer';

    // Extract log level from console API type
    const level = this.mapConsoleTypeToLogLevel(params.type);

    // Extract message from arguments
    const message = this.formatConsoleMessage(params.args);

    // Forward log if enabled for this source (pass instanceId for multiremote)
    if (isMainProcess && this.#captureMainLogs) {
      forwardLog(source, level, message, this.#mainLogLevel, this.#instanceId);
    } else if (!isMainProcess && this.#captureRendererLogs) {
      forwardLog(source, level, message, this.#rendererLogLevel, this.#instanceId);
    }
  }

  private mapConsoleTypeToLogLevel(type: string): LogLevel {
    switch (type) {
      case 'log':
      case 'info':
        return 'info';
      case 'warning':
        return 'warn';
      case 'error':
        return 'error';
      case 'debug':
        return 'debug';
      default:
        return 'info';
    }
  }

  private formatConsoleMessage(args: Runtime.RemoteObject[]): string {
    return args
      .map((arg) => {
        if (arg.type === 'string') {
          return arg.value;
        }
        if (arg.type === 'object' && arg.subtype === 'error') {
          return `${arg.description || 'Error'}`;
        }
        return arg.description || JSON.stringify(arg.value);
      })
      .join(' ');
  }
}
```

### 4. Update Service

**File: `packages/electron-service/src/service.ts`**

Add log capture initialization in `before` hook:
```typescript
async before(
  capabilities: WebdriverIO.Capabilities,
  _specs: string[],
  instance: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
): Promise<void> {
  // ... existing code ...
  
  // Setup log capture if enabled
  const options = this.getEffectiveOptions(capabilities);
  if (options.captureMainLogs || options.captureRendererLogs) {
    await this.setupLogCapture(cdpBridge, options);
  }
  
  // Patch browser.execute() for renderer log capture
  if (options.captureRendererLogs) {
    this.patchBrowserExecute(this.browser);
  }
}

private async setupLogCapture(
  cdpBridge: ElectronCdpBridge | undefined,
  options: ElectronServiceOptions,
): Promise<void> {
  if (!cdpBridge) {
    log.warn('CDP bridge not available, cannot capture logs');
    return;
  }
  
  // Configure bridge for log capture
  cdpBridge.enableLogCapture({
    captureMainLogs: options.captureMainLogs ?? false,
    captureRendererLogs: options.captureRendererLogs ?? false,
    mainLogLevel: options.mainLogLevel ?? 'info',
    rendererLogLevel: options.rendererLogLevel ?? 'info',
  });
}

private patchBrowserExecute(browser: WebdriverIO.Browser): void {
  // Similar to Tauri service's patchBrowserExecute
  // Wrap browser.execute() to capture console logs from renderer
  const originalExecute = browser.execute.bind(browser);
  
  browser.execute = async function patchedExecute<ReturnValue, InnerArguments extends unknown[]>(
    script: string | ((...args: InnerArguments) => ReturnValue),
    ...args: InnerArguments
  ): Promise<ReturnValue> {
    // Wrap script to capture console logs
    const wrappedScript = `
      (function() {
        const originalConsole = {
          log: console.log.bind(console),
          debug: console.debug.bind(console),
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
        };
        
        // Forward console logs via CDP (if available) or store for later retrieval
        function forwardLog(level, args) {
          originalConsole[level](...args);
          // Store logs for retrieval via browser.getLogs() or CDP
        }
        
        console.log = (...args) => { forwardLog('log', args); };
        console.debug = (...args) => { forwardLog('debug', args); };
        console.info = (...args) => { forwardLog('info', args); };
        console.warn = (...args) => { forwardLog('warn', args); };
        console.error = (...args) => { forwardLog('error', args); };
      })();
      
      return (${typeof script === 'function' ? script.toString() : script}).apply(null, arguments);
    `;
    
    return originalExecute(wrappedScript, ...args);
  };
}
```

### 5. Create Log Forwarder

**File: `packages/electron-service/src/logForwarder.ts`** (new file)

Adapt from Tauri service:
```typescript
import { createLogger } from '@wdio/native-utils';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

type WdioLogger = ReturnType<typeof createLogger>;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function getLoggerMethod(logger: WdioLogger, level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'trace':
    case 'debug':
      return logger.debug.bind(logger);
    case 'info':
      return logger.info.bind(logger);
    case 'warn':
      return logger.warn.bind(logger);
    case 'error':
      return logger.error.bind(logger);
    default:
      return logger.info.bind(logger);
  }
}

function formatLogMessage(source: 'main' | 'renderer', message: string, instanceId?: string): string {
  const sourceLabel = source === 'renderer' ? 'Renderer' : 'Main';
  const prefix = instanceId ? `[Electron:${sourceLabel}:${instanceId}]` : `[Electron:${sourceLabel}]`;
  return `${prefix} ${message}`;
}

export function forwardLog(
  source: 'main' | 'renderer',
  level: LogLevel,
  message: string,
  minLevel: LogLevel,
  instanceId?: string,
): void {
  if (!shouldLog(level, minLevel)) {
    return;
  }

  const formattedMessage = formatLogMessage(source, message, instanceId);

  // Check if we're in standalone mode (log writer initialized)
  if (isStandaloneLogWriterInitialized()) {
    const writer = getStandaloneLogWriter();
    writer.write(formattedMessage);
  } else {
    // Use WDIO logger (normal test runner mode)
    const logger = createLogger('electron-service', 'service');
    const loggerMethod = getLoggerMethod(logger, level);
    loggerMethod(formattedMessage);
  }
}
```

**Note:** Like Tauri, this implementation should use a standalone log writer when not running through the WDIO test runner. See the Tauri implementation of `logWriter.ts` and `session.ts` for reference.

### 5a. Standalone Mode Log Writer

**File: `packages/electron-service/src/logWriter.ts`** (new file)

Copy from Tauri service with minor adaptations:
```typescript
import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

/**
 * Log writer for standalone mode (when WDIO test runner is not available)
 */
export class StandaloneLogWriter {
  private logStream?: WriteStream;
  private logDir?: string;
  private logFile?: string;

  /**
   * Initialize log writer for standalone mode
   * Creates log directory and file stream
   */
  initialize(appName: string): void {
    // Calculate log directory based on WDIO convention: logs/standalone-{appName}/
    const cwd = process.cwd();
    this.logDir = join(cwd, 'logs', `standalone-${appName}`);

    // Create log directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = join(this.logDir, `wdio-${timestamp}.log`);

    // Create write stream
    this.logStream = createWriteStream(this.logFile, { flags: 'a' });
  }

  /**
   * Write log message to file
   */
  write(message: string): void {
    if (!this.logStream) {
      // If not initialized, write to stdout instead
      console.log(message);
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} INFO electron-service:service: ${message}\n`;
    this.logStream.write(formattedMessage);
  }

  /**
   * Close log stream
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }

  /**
   * Get log directory path
   */
  getLogDir(): string | undefined {
    return this.logDir;
  }

  /**
   * Get log file path
   */
  getLogFile(): string | undefined {
    return this.logFile;
  }
}

// Singleton instance for standalone mode
let standaloneWriter: StandaloneLogWriter | undefined;

/**
 * Get or create standalone log writer
 */
export function getStandaloneLogWriter(): StandaloneLogWriter {
  if (!standaloneWriter) {
    standaloneWriter = new StandaloneLogWriter();
  }
  return standaloneWriter;
}

/**
 * Check if standalone log writer is initialized
 */
export function isStandaloneLogWriterInitialized(): boolean {
  return !!standaloneWriter?.getLogFile();
}
```

**File: `packages/electron-service/src/session.ts`**

Update standalone session initialization to set up log writer:
```typescript
export async function init(
  capabilities: ElectronCapabilities,
  globalOptions?: ElectronServiceGlobalOptions,
): Promise<WebdriverIO.Browser> {
  log.debug('Initializing Electron service in standalone mode...');

  // Initialize standalone log writer if logging is enabled
  const serviceOptions = capabilities['wdio:electronServiceOptions'];
  if (serviceOptions?.captureMainLogs || serviceOptions?.captureRendererLogs) {
    const appName = serviceOptions.appName || 'electron';
    const writer = getStandaloneLogWriter();
    writer.initialize(appName);
    log.debug(`Standalone log writer initialized for: ${appName}`);
  }

  // ... rest of initialization ...
}

export async function cleanup(browser: WebdriverIO.Browser): Promise<void> {
  log.debug('Cleaning up Electron standalone session...');

  // ... existing cleanup ...

  // Close standalone log writer
  const writer = getStandaloneLogWriter();
  writer.close();

  // ... rest of cleanup ...
}
```

### 6. Update Documentation

**File: `packages/electron-service/README.md`**

Add Log Forwarding section:
```markdown
## Log Forwarding

The Electron service can capture and forward logs from both the main process and renderer processes to WebDriverIO's logger system.

### Enabling Log Forwarding

```typescript
services: [
  ['electron', {
    // Enable main process log capture (via CDP)
    captureMainLogs: true,
    // Enable renderer process log capture (via CDP + browser.execute patching)
    captureRendererLogs: true,
    // Minimum log level for main process logs (default: 'info')
    mainLogLevel: 'info',
    // Minimum log level for renderer process logs (default: 'info')
    rendererLogLevel: 'info',
  }]
]
```

### Log Levels

- `trace` - Most verbose
- `debug` - Debug information
- `info` - Informational messages (default)
- `warn` - Warning messages
- `error` - Error messages

### Log Format

- Main process logs: `[Electron:Main] message`
- Renderer process logs: `[Electron:Renderer] message`
- Multiremote logs: `[Electron:Main:instanceId] message` or `[Electron:Renderer:instanceId] message`
```

### 7. Testing Strategy

**Unit Tests:**
- Test log forwarder functions
- Test CDP event handling
- Test log level filtering
- Test browser.execute() patching
- Test standalone log writer initialization and writing

**E2E Tests:**

**Standard Mode (via WDIO test runner):**
- `e2e/test/electron/logging.spec.ts`
  - Test main process log capture
  - Test renderer process log capture
  - Test log level filtering
  - Test combined main + renderer logs

**Multiremote Mode:**
- `e2e/test/electron/multiremote/logging.spec.ts`
  - Test main process log capture with instance IDs (e.g., `[Electron:Main:browserA]`)
  - Test renderer process log capture with instance IDs (e.g., `[Electron:Renderer:browserB]`)
  - Test independent log capture per instance
  - Verify instance IDs are correctly included in log prefixes
  - Verify logs go to `logs/multiremote-{appDirName}/`

**Standalone Mode (direct execution with tsx, no WDIO runner):**
- `e2e/test/electron/standalone/logging.spec.ts`
  - Test main process log capture via standalone log writer
  - Test renderer process log capture via standalone log writer
  - Test log level filtering
  - Verify logs are written to files at `logs/standalone-{appName}/`
  - Verify standalone log writer closes properly on cleanup

**Verification Steps:**
- Confirm current behavior: logs are NOT being captured (baseline)
- Test that enabling log capture actually captures logs
- Test that disabling log capture doesn't capture logs
- Verify multiremote logs include instance IDs
- Verify standalone logs are written to disk without WDIO reporter

### 8. Implementation Order

1. ✅ Copy and adapt `logForwarder.ts` from Tauri service
2. ✅ Copy and adapt `logWriter.ts` from Tauri service for standalone mode
3. ✅ Add type definitions to `native-types`
4. ✅ Update `bridge.ts` to handle `Runtime.consoleAPICalled` events with instance ID support
5. ✅ Update `service.ts` to initialize log capture
6. ✅ Update `session.ts` to initialize standalone log writer
7. ✅ Implement `patchBrowserExecute()` for renderer logs
8. ✅ Write unit tests
9. ✅ Update documentation (including multiremote and standalone)
10. ✅ Write E2E tests for standard, multiremote, and standalone modes
11. ✅ Test on Windows, macOS, and Linux

### 9. Key Considerations

**Main Process Logs:**
- Use CDP `Runtime.consoleAPICalled` events
- Filter by execution context ID (main process context)
- Main process logs come from Node.js console in Electron main process

**Renderer Process Logs:**
- Use CDP `Runtime.consoleAPICalled` events for natural console logs
- Patch `browser.execute()` to capture logs from test scripts
- Renderer logs come from browser console in renderer processes

**Performance:**
- CDP event listeners are lightweight
- Log parsing is minimal overhead
- Consider rate limiting if high-volume logging

**Multiremote Support:**
- Each instance needs separate CDP bridge
- Track instance IDs for log prefixes (pass to `forwardLog()`)
- Ensure logs are correctly attributed to instances
- Log directory structure: `logs/multiremote-{appDirName}/`
- Instance IDs are extracted from capabilities (e.g., `--browser=A` → `browserA`)
- Log prefix format: `[Electron:Main:browserA]` or `[Electron:Renderer:browserB]`

**Standalone Mode Support:**
- Standalone mode uses direct script execution (tsx), not WDIO test runner
- WDIO reporter infrastructure is not available in standalone mode
- Must use custom `StandaloneLogWriter` to write logs directly to files
- Initialize log writer in `session.ts` `init()` function when logging is enabled
- Close log writer in `session.ts` `cleanup()` function
- Log directory structure: `logs/standalone-{appName}/`
- Log file naming: `wdio-{timestamp}.log`
- `forwardLog()` detects standalone mode via `isStandaloneLogWriterInitialized()`
- Standalone tests run sequentially via `tsx`, not in parallel like WDIO tests

## Future Enhancements

1. **Log buffering**: Buffer logs during test execution, flush at end
2. **Log file export**: Export captured logs to file
3. **Log aggregation**: Aggregate logs from multiple processes
4. **Performance metrics**: Track log volume and performance impact

