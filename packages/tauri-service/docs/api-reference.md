# API Reference

Complete API reference for @wdio/tauri-service.

## Exported Functions

### Command Execution

#### `execute(browser, script, ...args)`

Execute JavaScript code in the Tauri frontend context with access to Tauri APIs. Requires tauri-plugin-wdio to be installed and configured.

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance
- `script` (Function | string) - JavaScript code to execute. If a function, receives Tauri APIs as the first parameter
- `...args` (any[]) - Additional arguments passed to the script

**Returns:** `Promise<ReturnValue | undefined>`

**Example:**
```typescript
// Execute with function
const result = await browser.tauri.execute(({ invoke }) => {
  return invoke('get_platform_info');
});

// Execute with arguments
const result = await browser.tauri.execute((apis, param1, param2) => {
  console.log(param1, param2);
  return apis.invoke('my_command');
}, 'arg1', 'arg2');

// Execute string of code
const result = await browser.tauri.execute('window.location.href');
```

**Note:** This requires tauri-plugin-wdio to be installed. See [Plugin Setup](./plugin-setup.md).

---

#### `executeTauriCommand(browser, command, ...args)`

Execute a Tauri backend command and wait for the result.

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance
- `command` (string) - Name of the Tauri command to invoke
- `...args` (any[]) - Arguments passed to the command

**Returns:** `Promise<CommandResult>`

**Example:**
```typescript
const result = await browser.tauri.executeTauriCommand('get_platform_info');
const fileContent = await browser.tauri.executeTauriCommand('read_file', { path: '/path/to/file' });
```

---

#### `executeTauriCommands(browser, commands)`

Execute multiple Tauri commands sequentially (one after another).

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance
- `commands` (TauriCommandContext[]) - Array of commands to execute

**Returns:** `Promise<CommandResult[]>`

**Example:**
```typescript
const results = await browser.tauri.executeTauriCommands([
  { command: 'read_file', args: { path: '/file1' } },
  { command: 'read_file', args: { path: '/file2' } },
]);
```

---

#### `executeTauriCommandsParallel(browser, commands)`

Execute multiple Tauri commands in parallel (all at once).

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance
- `commands` (TauriCommandContext[]) - Array of commands to execute concurrently

**Returns:** `Promise<CommandResult[]>`

**Example:**
```typescript
const results = await browser.tauri.executeTauriCommandsParallel([
  { command: 'read_file', args: { path: '/file1' } },
  { command: 'read_file', args: { path: '/file2' } },
  { command: 'read_file', args: { path: '/file3' } },
]);
```

---

#### `executeTauriCommandWithTimeout(browser, command, timeout, ...args)`

Execute a Tauri command with a timeout.

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance
- `command` (string) - Name of the Tauri command
- `timeout` (number) - Timeout in milliseconds
- `...args` (any[]) - Arguments passed to the command

**Returns:** `Promise<CommandResult>`

**Throws:** Error if command exceeds timeout

**Example:**
```typescript
const result = await browser.tauri.executeTauriCommandWithTimeout(
  'slow_command',
  5000,  // 5 second timeout
  { param: 'value' }
);
```

---

### Mock Functions

#### `mock(command)`

Mock a specific Tauri backend command. Returns a TauriMock object for configuring the mock behavior.

**Parameters:**
- `command` (string) - Name of the Tauri command to mock

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('read_file');
await mock.mockReturnValue('mocked file content');

// Now calling invoke('read_file', ...) returns 'mocked file content'
const content = await browser.tauri.execute(({ invoke }) => invoke('read_file'));
expect(content).toBe('mocked file content');
```

---

#### `mockAll()`

Mock all Tauri commands. Useful for isolated testing.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await browser.tauri.mockAll();
// All commands are now mocked, will return undefined by default
```

---

#### `isMockFunction(command)`

Check if a command is currently mocked.

**Parameters:**
- `command` (string) - Name of the command to check

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isMocked = await browser.tauri.isMockFunction('read_file');
console.log(isMocked); // true if mocked, false otherwise
```

---

#### `clearAllMocks()`

Clear all mock call history and reset results, but keep the mock implementations in place.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
const mock = await browser.tauri.mock('my_command');
await mock.mockReturnValue('first call');

// Call the command
await browser.tauri.execute(({ invoke }) => invoke('my_command'));

// Clear history
await browser.tauri.clearAllMocks();

// Mock still exists but with cleared history
const isMocked = await browser.tauri.isMockFunction('my_command');
console.log(isMocked); // true
```

---

#### `resetAllMocks()`

Reset all mocks to their initial state (clears implementations and call history).

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await browser.tauri.resetAllMocks();
// All mocks are reset to default behavior
```

---

#### `restoreAllMocks()`

Remove all mocks and restore original command implementations.

**Parameters:** None

**Returns:** `Promise<void>`

**Example:**
```typescript
await browser.tauri.restoreAllMocks();
// Commands now call the real Tauri backend again
```

---

### TauriMock Interface

When you call `mock(command)`, you receive a TauriMock object with these methods:

#### `mockImplementation(fn)`

Set a custom implementation function for the mock.

**Parameters:**
- `fn` (Function) - Custom implementation function

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('calculate');
await mock.mockImplementation(async (x, y) => x + y);

const result = await browser.tauri.execute(({ invoke }) => invoke('calculate', { x: 5, y: 3 }));
// result = 8
```

---

#### `mockImplementationOnce(fn)`

Set a custom implementation for the next call only.

**Parameters:**
- `fn` (Function) - Custom implementation for one call

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('my_command');
await mock.mockImplementationOnce(() => 'first call');
await mock.mockImplementationOnce(() => 'second call');

const r1 = await browser.tauri.execute(({ invoke }) => invoke('my_command'));
const r2 = await browser.tauri.execute(({ invoke }) => invoke('my_command'));

console.log(r1); // 'first call'
console.log(r2); // 'second call'
```

---

#### `mockReturnValue(value)`

Set the mock to return a specific value.

**Parameters:**
- `value` (any) - Value to return

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('get_user');
await mock.mockReturnValue({ id: 1, name: 'John' });

const user = await browser.tauri.execute(({ invoke }) => invoke('get_user'));
// user = { id: 1, name: 'John' }
```

---

#### `mockReturnValueOnce(value)`

Set the mock to return a specific value for the next call only.

**Parameters:**
- `value` (any) - Value to return for next call

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('counter');
await mock.mockReturnValueOnce(1);
await mock.mockReturnValueOnce(2);
await mock.mockReturnValue(3); // default for subsequent calls

const r1 = await browser.tauri.execute(({ invoke }) => invoke('counter'));
const r2 = await browser.tauri.execute(({ invoke }) => invoke('counter'));
const r3 = await browser.tauri.execute(({ invoke }) => invoke('counter'));

console.log(r1, r2, r3); // 1, 2, 3
```

---

#### `mockResolvedValue(value)`

Set the mock to return a promise that resolves to the given value.

**Parameters:**
- `value` (any) - Value for the resolved promise

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('fetch_data');
await mock.mockResolvedValue({ data: 'test' });

const result = await browser.tauri.execute(({ invoke }) => invoke('fetch_data'));
// result = { data: 'test' }
```

---

#### `mockResolvedValueOnce(value)`

Set the mock to resolve to a value for the next call only.

**Parameters:**
- `value` (any) - Value for next resolved promise

**Returns:** `Promise<TauriMock>`

---

#### `mockRejectedValue(error)`

Set the mock to return a promise that rejects with an error.

**Parameters:**
- `error` (Error | string) - Error to reject with

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('risky_operation');
await mock.mockRejectedValue(new Error('Operation failed'));

// Calling the command will throw
try {
  await browser.tauri.execute(({ invoke }) => invoke('risky_operation'));
} catch (e) {
  console.log(e.message); // 'Operation failed'
}
```

---

#### `mockRejectedValueOnce(error)`

Set the mock to reject for the next call only.

**Parameters:**
- `error` (Error | string) - Error to reject with for next call

**Returns:** `Promise<TauriMock>`

---

#### `mockClear()`

Clear the call history of this mock without resetting its implementation.

**Parameters:** None

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('my_command');
await mock.mockReturnValue('test');

// Make some calls
await browser.tauri.execute(({ invoke }) => invoke('my_command'));

// Check calls
const calls = await mock.getMockCalls?.();
console.log(calls.length); // 1

// Clear history
await mock.mockClear();

// Calls cleared but mock still returns 'test'
```

---

#### `mockReset()`

Reset the mock to its initial state (clears both implementation and call history).

**Parameters:** None

**Returns:** `Promise<TauriMock>`

---

#### `mockRestore()`

Remove this mock and restore the original command implementation.

**Parameters:** None

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('my_command');
await mock.mockReturnValue('mocked');

// Later, restore the original
await mock.mockRestore();

// Now calls the real command again
```

---

#### `mockReturnThis()`

Set the mock to return `this` when called (useful for chaining).

**Parameters:** None

**Returns:** `Promise<TauriMock>`

---

#### `mockName(name)`

Set a display name for the mock (useful for debugging).

**Parameters:**
- `name` (string) - Name to display

**Returns:** `Promise<TauriMock>`

---

#### `getMockName()`

Get the display name of the mock.

**Parameters:** None

**Returns:** `Promise<string>`

---

#### `getMockImplementation()`

Get the current implementation function of the mock.

**Parameters:** None

**Returns:** `Promise<Function>`

---

#### `withImplementation(implFn, callbackFn)`

Temporarily use a different implementation for the duration of a callback.

**Parameters:**
- `implFn` (Function) - Temporary implementation
- `callbackFn` (Function) - Callback to run with temporary implementation

**Returns:** `Promise<TauriMock>`

**Example:**
```typescript
const mock = await browser.tauri.mock('my_command');
await mock.mockReturnValue('default');

await mock.withImplementation(
  () => 'temporary',
  async () => {
    const result = await browser.tauri.execute(({ invoke }) => invoke('my_command'));
    console.log(result); // 'temporary'
  }
);

const result = await browser.tauri.execute(({ invoke }) => invoke('my_command'));
console.log(result); // 'default'
```

---

### Utility Functions

#### `getTauriAppInfo(appPath)`

Get information about a Tauri application from its tauri.conf.json.

**Parameters:**
- `appPath` (string) - Path to the Tauri app directory

**Returns:** `Promise<TauriAppInfo>`

**Returns object structure:**
```typescript
{
  name: string;
  version: string;
  binaryPath: string;
  configPath: string;
  targetDir: string;
}
```

**Example:**
```typescript
const appInfo = await getTauriAppInfo('./fixtures/e2e-apps/tauri');
console.log(appInfo.version); // e.g., "0.1.0"
```

---

#### `getTauriBinaryPath(appPath, platform?, arch?)`

Resolve the path to the Tauri application binary.

**Parameters:**
- `appPath` (string) - Path to the Tauri app directory (e.g., "./src-tauri" or the parent dir)
- `platform?` (string) - Optional platform override (defaults to current platform)
- `arch?` (string) - Optional architecture override (defaults to current arch)

**Returns:** `Promise<string>`

**Example:**
```typescript
const binaryPath = await getTauriBinaryPath('./fixtures/e2e-apps/tauri');
// Returns: "./fixtures/e2e-apps/tauri/src-tauri/target/release/my-app.exe" (on Windows)
```

---

#### `isTauriAppBuilt(appPath)`

Check if a Tauri application has been built.

**Parameters:**
- `appPath` (string) - Path to the Tauri app directory

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isBuilt = await isTauriAppBuilt('./fixtures/e2e-apps/tauri');
console.log(isBuilt); // true if release binary exists
```

---

#### `getTauriVersion(browser)`

Get the version of Tauri running in the connected app.

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance

**Returns:** `Promise<string>`

**Example:**
```typescript
const version = await browser.tauri.getTauriVersion?.();
console.log(version); // e.g., "2.9.3"
```

---

#### `isTauriApiAvailable(browser)`

Check if the Tauri API is available in the connected app.

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const available = await browser.tauri.isTauriApiAvailable?.();
console.log(available); // true if Tauri plugin is loaded
```

---

#### `getTauriAppInfoFromBrowser(browser)`

Get app information directly from the browser (alias for getTauriAppInfo).

**Parameters:**
- `browser` (WebdriverIO.Browser) - WebdriverIO browser instance

**Returns:** `Promise<TauriAppInfo>`

---

### Session Management (Standalone Mode)

#### `startWdioSession(capabilities, globalOptions)`

Initialize the Tauri service in standalone mode (exported as `init`). Use this when you want to manage the session manually outside of WebdriverIO's lifecycle.

**Parameters:**
- `capabilities` (Capabilities) - WebdriverIO capabilities with Tauri options
- `globalOptions?` (TauriServiceGlobalOptions) - Global service options

**Returns:** `Promise<Browser>`

**Example:**
```typescript
import { startWdioSession } from '@wdio/tauri-service';

const browser = await startWdioSession({
  browserName: 'tauri',
  'tauri:options': {
    application: './path/to/app.exe'
  }
});

// Use browser...

await browser.deleteSession();
```

---

#### `cleanupWdioSession(browser)`

Clean up a Tauri session started with startWdioSession (exported as `cleanup`).

**Parameters:**
- `browser` (WebdriverIO.Browser) - Browser instance to clean up

**Returns:** `Promise<void>`

**Example:**
```typescript
import { cleanupWdioSession } from '@wdio/tauri-service';

await cleanupWdioSession(browser);
```

---

#### `createTauriCapabilities(appBinaryPath, options)`

Create Tauri-specific capabilities for use in WebdriverIO config.

**Parameters:**
- `appBinaryPath` (string) - Path to the Tauri app binary
- `options?` (Partial<TauriServiceOptions>) - Optional Tauri service options

**Returns:** `TauriCapabilities`

**Example:**
```typescript
import { createTauriCapabilities } from '@wdio/tauri-service';

const capabilities = createTauriCapabilities('./path/to/app.exe', {
  autoInstallTauriDriver: true,
  captureBackendLogs: true
});
```

---

#### `getTauriServiceStatus()`

Get the current status of the Tauri service.

**Parameters:** None

**Returns:** `Promise<ServiceStatus>`

---

### Edge Driver Management (Windows Only)

#### `detectEdgeVersion()`

Detect the installed Microsoft Edge version on Windows from the registry.

**Parameters:** None

**Returns:** `Promise<string | undefined>`

**Example:**
```typescript
import { detectEdgeVersion } from '@wdio/tauri-service';

const version = await detectEdgeVersion();
console.log(version); // e.g., "143.0.3650.139"
```

**Platform:** Windows only (returns undefined on other platforms)

---

#### `detectWebView2VersionFromBinary(binaryPath)`

Detect the WebView2 version embedded in a Tauri binary. This is more accurate than detecting system Edge for Tauri apps.

**Parameters:**
- `binaryPath` (string) - Path to the Tauri app binary

**Returns:** `Promise<string | undefined>`

**Example:**
```typescript
import { detectWebView2VersionFromBinary } from '@wdio/tauri-service';

const version = await detectWebView2VersionFromBinary('./my-app.exe');
console.log(version); // e.g., "143.0.3650.139"
```

**Platform:** Windows only

---

#### `ensureMsEdgeDriver(binaryPath, autoDownload)`

Ensure that MSEdgeDriver is available and matches the Tauri app's WebView2 version. This is called automatically during service initialization.

**Parameters:**
- `binaryPath?` (string) - Path to the Tauri app binary (for WebView2 detection)
- `autoDownload?` (boolean) - Whether to automatically download if missing (default: true)

**Returns:** `Promise<EdgeDriverResult>`

**Returns object structure:**
```typescript
{
  success: boolean;
  driverPath?: string;
  driverVersion?: string;
  edgeVersion?: string;
  method?: 'found' | 'downloaded' | 'skipped';
  error?: string;
}
```

**Example:**
```typescript
import { ensureMsEdgeDriver } from '@wdio/tauri-service';

const result = await ensureMsEdgeDriver('./my-app.exe', true);
if (result.success) {
  console.log(`Using ${result.method}: ${result.driverPath}`);
}
```

**Platform:** Windows only (skips on Linux/macOS)

---

#### `findMsEdgeDriver()`

Find the MSEdgeDriver executable in the system PATH and get its version.

**Parameters:** None

**Returns:** `Promise<{ path?: string; version?: string }>`

**Example:**
```typescript
import { findMsEdgeDriver } from '@wdio/tauri-service';

const driver = await findMsEdgeDriver();
if (driver.path) {
  console.log(`Found driver at: ${driver.path}`);
}
```

---

#### `downloadMsEdgeDriver(edgeVersion)`

Download MSEdgeDriver from Microsoft's CDN for a specific Edge version.

**Parameters:**
- `edgeVersion` (string) - Full version string (e.g., "143.0.3650.139")

**Returns:** `Promise<string>` - Path to downloaded driver executable

**Throws:** Error if download fails

**Example:**
```typescript
import { downloadMsEdgeDriver } from '@wdio/tauri-service';

const driverPath = await downloadMsEdgeDriver('143.0.3650.139');
console.log(`Downloaded to: ${driverPath}`);
```

---

#### `getMajorVersion(version)`

Extract the major version from a version string.

**Parameters:**
- `version` (string) - Full version string

**Returns:** `string` - Major version number

**Example:**
```typescript
import { getMajorVersion } from '@wdio/tauri-service';

const major = getMajorVersion('143.0.3650.139');
console.log(major); // "143"
```

---

## Exported Types

### `TauriAppInfo`

Information about a Tauri application.

```typescript
interface TauriAppInfo {
  name: string;
  version: string;
  binaryPath: string;
  configPath: string;
  targetDir: string;
}
```

---

### `TauriCapabilities`

WebdriverIO capabilities extended with Tauri-specific options.

```typescript
interface TauriCapabilities {
  browserName?: 'tauri' | 'wry';
  'tauri:options'?: {
    application: string;
    args?: string[];
  };
  [key: string]: any;
}
```

---

### `TauriServiceOptions`

Configuration options for the Tauri service.

```typescript
interface TauriServiceOptions {
  appBinaryPath?: string;
  appArgs?: string[];
  tauriDriverPort?: number;
  tauriDriverPath?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  commandTimeout?: number;
  startTimeout?: number;
  captureBackendLogs?: boolean;
  captureFrontendLogs?: boolean;
  backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  autoInstallTauriDriver?: boolean;
  autoDownloadEdgeDriver?: boolean;
  logDir?: string;
}
```

---

### `EdgeDriverResult`

Result of Edge driver management operation.

```typescript
interface EdgeDriverResult {
  success: boolean;
  driverPath?: string;
  driverVersion?: string;
  edgeVersion?: string;
  method?: 'found' | 'downloaded' | 'skipped';
  error?: string;
}
```

---

### `TauriCommandContext`

Context for a Tauri command to be executed.

```typescript
interface TauriCommandContext {
  command: string;
  args?: any;
  timeout?: number;
}
```

---

### `TauriResult<T>`

Generic result type for Tauri operations.

```typescript
interface TauriResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

## browser.tauri.* Methods

The following methods are available on the `browser.tauri` object when connected to a Tauri app:

- **`browser.tauri.execute(script, ...args)`** - See [execute()](#executebrowser-script-args) above
- **`browser.tauri.mock(command)`** - See [mock()](#mockcommand) above
- **`browser.tauri.isMockFunction(command)`** - See [isMockFunction()](#ismockfunctioncommand) above
- **`browser.tauri.mockAll()`** - See [mockAll()](#mockall) above
- **`browser.tauri.clearAllMocks()`** - See [clearAllMocks()](#clearallmocks) above
- **`browser.tauri.resetAllMocks()`** - See [resetAllMocks()](#resetallmocks) above
- **`browser.tauri.restoreAllMocks()`** - See [restoreAllMocks()](#restoreallmocks) above
- **`browser.tauri.getTauriVersion?()`** - Get Tauri version string
- **`browser.tauri.isTauriApiAvailable?()`** - Check if Tauri API is loaded
- **`browser.tauri.getTauriAppInfo?()`** - Get app information

---

## Notes

- All functions requiring tauri-plugin-wdio will throw an error if the plugin is not installed. See [Plugin Setup](./plugin-setup.md).
- Mocking requires tauri-plugin-wdio for invoke interception to work.
- Edge driver functions are Windows-only and will return early/undefined on other platforms.
- For detailed configuration examples, see [Configuration](./configuration.md).
