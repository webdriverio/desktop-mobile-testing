# Standalone Mode

You can also use the service without the WDIO testrunner, e.g. in a normal Node.js script.

The `startWdioSession` method accepts `ElectronServiceCapabilities`, which are the capabilities specified in a regular [WDIO configuration](./configuration/service-configuration.md).

The method creates a new WDIO session using your configuration and returns the WebdriverIO browser object:

```TS
import { startWdioSession } from '@wdio/electron-service';

const browser = await startWdioSession([{
  'browserName': 'electron', // you need to specify browserName
  'browserVersion': '33.2.1',
  'wdio:electronServiceOptions': {
    appBinaryPath: '/path/to/binary',
  },
  'goog:chromeOptions': {
    args: ['--disable-dev-shm-usage', '--disable-gpu', '--headless'],
  },
  'wdio:chromedriverOptions': {
    binary: '/path/to/chromedriver',
  },
}]);

const appName = await browser.electron.execute((electron) => electron.app.getName());
```

`rootDir` can be specified in the second (optional) `ElectronServiceGlobalOptions` parameter, which also accepts mocking preferences for the session:

```TS
const browser = await startWdioSession([
  { ... },
  {
    rootDir: '/path/to/dir',
    clearMocks: false,
    resetMocks: false,
    restoreMocks: true,
  }
]);
```

## Log Capture in Standalone Mode

Standalone mode supports capturing console logs from both main and renderer processes. Unlike test runner mode where logs are forwarded to WDIO's logger, standalone mode writes logs to timestamped files.

### Basic Log Capture

```ts
import { startWdioSession, cleanupWdioSession } from '@wdio/electron-service';

const browser = await startWdioSession([{
  browserName: 'electron',
  'wdio:electronServiceOptions': {
    appBinaryPath: '/path/to/binary',
    captureMainProcessLogs: true,
    captureRendererLogs: true,
    mainProcessLogLevel: 'info',
    rendererLogLevel: 'info',
    logDir: './test-logs'  // Required for standalone mode
  }
}]);

// Your test code - logs are being captured
await browser.electron.execute(() => {
  console.log('[Main] Application started');
  console.warn('[Main] Using deprecated API');
});

await browser.execute(() => {
  console.log('[Renderer] Page loaded');
  console.error('[Renderer] Failed to fetch data');
});

// Cleanup - closes log file
await cleanupWdioSession(browser);
```

### Log File Output

Logs are written to `{logDir}/wdio-{timestamp}.log`:

```
2025-12-29T19:07:00.123Z INFO electron-service:service: [Electron:MainProcess] [Main] Application started
2025-12-29T19:07:00.456Z WARN electron-service:service: [Electron:MainProcess] [Main] Using deprecated API
2025-12-29T19:07:01.123Z INFO electron-service:service: [Electron:Renderer] [Renderer] Page loaded
2025-12-29T19:07:01.456Z ERROR electron-service:service: [Electron:Renderer] [Renderer] Failed to fetch data
```

### Log Level Filtering

Control which logs are captured by setting minimum log levels:

```ts
const browser = await startWdioSession([{
  browserName: 'electron',
  'wdio:electronServiceOptions': {
    appBinaryPath: '/path/to/binary',
    captureMainProcessLogs: true,
    mainProcessLogLevel: 'warn',  // Only warn and error
    captureRendererLogs: true,
    rendererLogLevel: 'debug',    // Debug, info, warn, and error
    logDir: './logs'
  }
}]);
```

### Reading Logs Programmatically

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// After test execution
const logDir = './test-logs';
const logFiles = readdirSync(logDir).filter(f => f.startsWith('wdio-'));
const latestLog = logFiles.sort().reverse()[0];
const logContent = readFileSync(join(logDir, latestLog), 'utf-8');

// Parse or analyze logs
const mainProcessLogs = logContent
  .split('\n')
  .filter(line => line.includes('[Electron:MainProcess]'));
```

### Important Notes

- **`logDir` is required**: Logs cannot be captured in standalone mode without specifying `logDir`
- **Automatic cleanup**: Call `cleanupWdioSession()` to ensure log files are properly closed
- **CDP requirements**:
  - **Main process logs**: Require the `EnableNodeCliInspectArguments` fuse to be enabled
  - **Renderer process logs**: Work independently via Puppeteer, no fuse requirement
  - If the CDP bridge is unavailable, only main process logs will be disabled (renderer logs continue to work)
- **No WDIO logger**: In standalone mode, logs are written to files, not forwarded to WDIO's logger
