# API Reference

This document provides a complete reference for all `browser.electron.*` methods provided by the service.

## Table of Contents

- [Execution Methods](#execution-methods)
  - [`execute()`](#execute)
  - [`triggerDeeplink()`](#triggerdeeplink)
- [Mocking Methods](#mocking-methods)
  - [`mock()`](#mock)
  - [`mockAll()`](#mockall)
  - [`clearAllMocks()`](#clearallmocks)
  - [`resetAllMocks()`](#resetallmocks)
  - [`restoreAllMocks()`](#restoreallmocks)
  - [`isMockFunction()`](#ismockfunction)
- [Mock Object Methods](#mock-object-methods)
  - [`mockImplementation()`](#mockimplementation)
  - [`mockImplementationOnce()`](#mockimplementationonce)
  - [`mockReturnValue()`](#mockreturnvalue)
  - [`mockReturnValueOnce()`](#mockreturnvalueonce)
  - [`mockResolvedValue()`](#mockresolvedvalue)
  - [`mockResolvedValueOnce()`](#mockresolvedvalueonce)
  - [`mockRejectedValue()`](#mockrejectedvalue)
  - [`mockRejectedValueOnce()`](#mockrejectedvalueonce)
  - [`mockClear()`](#mockclear)
  - [`mockReset()`](#mockreset)
  - [`mockRestore()`](#mockrestore)
  - [`withImplementation()`](#withimplementation)
  - [`getMockImplementation()`](#getmockimplementation)
  - [`getMockName()`](#getmockname)
  - [`mockName()`](#mockname)
  - [`mockReturnThis()`](#mockreturnthis)
- [Mock Object Properties](#mock-object-properties)
  - [`mock.calls`](#mockcalls)
  - [`mock.lastCall`](#mocklastcall)
  - [`mock.results`](#mockresults)
  - [`mock.invocationCallOrder`](#mockinvocationcallorder)
- [Electron Class Mock](#electron-class-mock)
  - [`__constructor`](#__constructor)
  - [`[methodName]`](#methodname)
  - [`mockRestore()`](#mockrestore)

---

## Execution Methods

### `execute()`

Executes arbitrary JavaScript code in the Electron main process context.

**Signature:**
```ts
browser.electron.execute<T>(
  script: (electron, ...args) => T | Promise<T>,
  ...args: any[]
): Promise<T>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `script` | `(electron, ...args) => T \| Promise<T>` | Function to execute in main process. First arg is always the `electron` module. |
| `...args` | `any[]` | Additional arguments passed to the script function |

**Returns:**

`Promise<T>` - Resolves with the return value of the script

**Example:**

```ts
// Simple execution
const appName = await browser.electron.execute((electron) => {
  return electron.app.getName();
});

// With parameters
const result = await browser.electron.execute(
  (electron, param1, param2) => {
    return param1 + param2;
  },
  5,
  10
);

// With async code
const fileIcon = await browser.electron.execute(async (electron) => {
  return await electron.app.getFileIcon('/path/to/file');
});
```

**See Also:**
- [Electron APIs Guide](./electron-apis.md)

---

### `triggerDeeplink()`

Triggers a deeplink to the Electron application for testing protocol handlers.

On Windows and Linux, this automatically appends the test instance's `userData` directory to ensure the deeplink reaches the correct instance. On macOS, it works transparently without modification.

**Signature:**
```ts
browser.electron.triggerDeeplink(url: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | The deeplink URL to trigger (e.g., `'myapp://open?path=/test'`). Must use a custom protocol scheme (not http/https/file). |

**Returns:**

`Promise<void>` - Resolves when the deeplink has been triggered.

**Throws:**

| Error | Condition |
|-------|-----------|
| `Error` | If `appBinaryPath` is not configured (Windows/Linux only) |
| `Error` | If the URL is invalid or malformed |
| `Error` | If the URL uses http/https/file protocols |
| `Error` | If the platform is unsupported |
| `Error` | If the command to trigger the deeplink fails |

**Example:**

```ts
// Basic usage
await browser.electron.triggerDeeplink('myapp://open?file=test.txt');

// With complex parameters
await browser.electron.triggerDeeplink('myapp://action?id=123&type=user&tags[]=a&tags[]=b');

// In a test with verification
it('should handle deeplinks', async () => {
  await browser.electron.triggerDeeplink('myapp://navigate?to=/settings');

  await browser.waitUntil(async () => {
    const currentPath = await browser.electron.execute(() => {
      return globalThis.currentPath;
    });
    return currentPath === '/settings';
  }, {
    timeout: 5000,
    timeoutMsg: 'App did not process the deeplink'
  });
});
```

**Platform-Specific Behavior:**

- **Windows**: Cannot use `appEntryPoint` (must use packaged binary). Automatically appends `userData` parameter to URL.
- **macOS**: Works with both packaged binaries and script-based apps. No URL modification.
- **Linux**: Cannot use `appEntryPoint` (must use packaged binary). Automatically appends `userData` parameter to URL.

**See Also:**
- [Deeplink Testing Guide](./deeplink-testing.md)

---

## Mocking Methods

### `mock()`

Mocks an Electron API function when provided with an API name and function name. Returns a [mock object](#mock-object-methods).

When called with only an API name (no function name), mocks an entire Electron class (e.g., `'Tray'`, `'BrowserWindow'`). Returns an [Electron class mock object](#electron-class-mock).

**Signature:**
```ts
// Mock a specific function
browser.electron.mock(apiName: string, funcName: string): Promise<MockObject>

// Mock an entire class
browser.electron.mock(className: string): Promise<ElectronClassMock>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiName` | `string` | The Electron API module name (e.g., `'dialog'`, `'app'`, `'clipboard'`) or class name (e.g., `'Tray'`, `'BrowserWindow'`) |
| `funcName` | `string` | **Optional.** The function name to mock (e.g., `'showOpenDialog'`, `'getName'`). If omitted, mocks the entire class. |

**Returns:**

`Promise<MockObject | ElectronClassMock>` - A mock object with methods for controlling and inspecting the mock, or an Electron class mock object for class mocking

**Example:**

```ts
const mockedShowOpenDialog = await browser.electron.mock('dialog', 'showOpenDialog');
await browser.electron.execute(
  async (electron) =>
    await electron.dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    }),
);

expect(mockedShowOpenDialog).toHaveBeenCalledTimes(1);
expect(mockedShowOpenDialog).toHaveBeenCalledWith({
  properties: ['openFile', 'openDirectory'],
});

// Class mocking
const mockTray = await browser.electron.mock('Tray');
await mockTray.setTitle.mockReturnValue(undefined);

// Track constructor calls
const tray = await browser.electron.execute((electron) => new electron.Tray('/path/to/icon.png'));
expect(mockTray.__constructor).toHaveBeenCalledWith('/path/to/icon.png');

// Mock instance methods
await browser.electron.execute((electron) => {
  const tray = new electron.Tray('/path/to/icon.png');
  tray.setTitle('My App');
});
expect(mockTray.setTitle).toHaveBeenCalledWith('My App');
```

**See Also:**
- [Electron APIs Guide](./electron-apis.md#mocking-electron-apis)

---

### `mockAll()`

Mocks all functions on an Electron API module simultaneously. Returns an object containing all mocks.

**Signature:**
```ts
browser.electron.mockAll(apiName: string): Promise<Record<string, MockObject>>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiName` | `string` | The Electron API module name (e.g., `'dialog'`, `'app'`) |

**Returns:**

`Promise<Record<string, MockObject>>` - Object with function names as keys and mock objects as values

**Example:**

```ts
const { showOpenDialog, showMessageBox } = await browser.electron.mockAll('dialog');
await showOpenDialog.mockReturnValue('I opened a dialog!');
await showMessageBox.mockReturnValue('I opened a message box!');
```

**See Also:**
- [Electron APIs Guide](./electron-apis.md#mocking-electron-apis)

---

### `clearAllMocks()`

Calls [`mockClear()`](#mockclear) on all active mocks, or on mocks of a specific API if `apiName` is provided.

**Signature:**
```ts
browser.electron.clearAllMocks(apiName?: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiName` | `string` | Optional. If provided, only clears mocks of this specific API |

**Returns:**

`Promise<void>`

**Example:**

```ts
// Clear all mocks
const mockSetName = await browser.electron.mock('app', 'setName');
const mockWriteText = await browser.electron.mock('clipboard', 'writeText');

await browser.electron.execute((electron) => electron.app.setName('new app name'));
await browser.electron.execute((electron) => electron.clipboard.writeText('text to be written'));

await browser.electron.clearAllMocks();

expect(mockSetName.mock.calls).toStrictEqual([]);
expect(mockWriteText.mock.calls).toStrictEqual([]);

// Clear mocks of specific API
await browser.electron.clearAllMocks('app');
expect(mockSetName.mock.calls).toStrictEqual([]);
expect(mockWriteText.mock.calls).toStrictEqual([['text to be written']]);
```

---

### `resetAllMocks()`

Calls [`mockReset()`](#mockreset) on all active mocks, or on mocks of a specific API if `apiName` is provided.

**Signature:**
```ts
browser.electron.resetAllMocks(apiName?: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiName` | `string` | Optional. If provided, only resets mocks of this specific API |

**Returns:**

`Promise<void>`

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.resetAllMocks();

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBeUndefined();
expect(clipboardText).toBeUndefined();
```

---

### `restoreAllMocks()`

Calls [`mockRestore()`](#mockrestore) on all active mocks, or on mocks of a specific API if `apiName` is provided.

**Signature:**
```ts
browser.electron.restoreAllMocks(apiName?: string): Promise<void>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `apiName` | `string` | Optional. If provided, only restores mocks of this specific API |

**Returns:**

`Promise<void>`

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
const mockReadText = await browser.electron.mock('clipboard', 'readText');
await mockGetName.mockReturnValue('mocked appName');
await mockReadText.mockReturnValue('mocked clipboardText');

await browser.electron.restoreAllMocks();

const appName = await browser.electron.execute((electron) => electron.app.getName());
const clipboardText = await browser.electron.execute((electron) => electron.clipboard.readText());
expect(appName).toBe('my real app name');
expect(clipboardText).toBe('some real clipboard text');
```

---

### `isMockFunction()`

Checks if a given parameter is an Electron mock function. If using TypeScript, narrows down the type.

**Signature:**
```ts
browser.electron.isMockFunction(fn: any): fn is MockObject
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `any` | The value to check |

**Returns:**

`boolean` - `true` if the value is a mock function, `false` otherwise

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');

expect(browser.electron.isMockFunction(mockGetName)).toBe(true);
expect(browser.electron.isMockFunction(() => {})).toBe(false);
```

---

## Mock Object Methods

Each mock object returned by [`mock()`](#mock) or [`mockAll()`](#mockall) has the following methods:

### `mockImplementation()`

Accepts a function that will be used as the implementation of the mock.

**Signature:**
```ts
mockImplementation(fn: (...args: any[]) => any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `(...args: any[]) => any` | Function to use as mock implementation |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
let callsCount = 0;
await mockGetName.mockImplementation(() => {
  if (typeof callsCount !== 'undefined') {
    callsCount++;
  }
  return 'mocked value';
});

const result = await browser.electron.execute(async (electron) => await electron.app.getName());
expect(callsCount).toBe(1);
expect(result).toBe('mocked value');
```

---

### `mockImplementationOnce()`

Accepts a function that will be used as mock's implementation during the next call. If chained, every consecutive call will produce different results. When implementations run out, falls back to the default implementation set with [`mockImplementation()`](#mockimplementation).

**Signature:**
```ts
mockImplementationOnce(fn: (...args: any[]) => any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fn` | `(...args: any[]) => any` | Function to use for the next call |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockImplementationOnce(() => 'first mock');
await mockGetName.mockImplementationOnce(() => 'second mock');

let name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('first mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('second mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeNull();
```

---

### `mockReturnValue()`

Accepts a value that will be returned whenever the mock function is called.

**Signature:**
```ts
mockReturnValue(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to return from the mock |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('mocked name');
```

---

### `mockReturnValueOnce()`

Accepts a value that will be returned during the next function call. If chained, every consecutive call will return the specified value. When values run out, falls back to the previously defined implementation.

**Signature:**
```ts
mockReturnValueOnce(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to return for the next call |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValueOnce('first mock');
await mockGetName.mockReturnValueOnce('second mock');

let name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('first mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe('second mock');
name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeNull();
```

---

### `mockResolvedValue()`

Accepts a value that will be resolved (for async functions) whenever the mock is called.

**Signature:**
```ts
mockResolvedValue(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to resolve from the mock |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
await mockGetFileIcon.mockResolvedValue('This is a mock');

const fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));

expect(fileIcon).toBe('This is a mock');
```

---

### `mockResolvedValueOnce()`

Accepts a value that will be resolved during the next function call. If chained, every consecutive call will resolve the specified value. When values run out, falls back to the previously defined implementation.

**Signature:**
```ts
mockResolvedValueOnce(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to resolve for the next call |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await mockGetFileIcon.mockResolvedValue('default mocked icon');
await mockGetFileIcon.mockResolvedValueOnce('first mocked icon');
await mockGetFileIcon.mockResolvedValueOnce('second mocked icon');

let fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('first mocked icon');
fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('second mocked icon');
fileIcon = await browser.electron.execute(async (electron) => await electron.app.getFileIcon('/path/to/icon'));
expect(fileIcon).toBe('default mocked icon');
```

---

### `mockRejectedValue()`

Accepts a value that will be rejected (for async functions) whenever the mock is called.

**Signature:**
```ts
mockRejectedValue(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to reject from the mock |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
await mockGetFileIcon.mockRejectedValue('This is a mock error');

const fileIconError = await browser.electron.execute(async (electron) => {
  try {
    await electron.app.getFileIcon('/path/to/icon');
  } catch (e) {
    return e;
  }
});

expect(fileIconError).toBe('This is a mock error');
```

---

### `mockRejectedValueOnce()`

Accepts a value that will be rejected during the next function call. If chained, every consecutive call will reject the specified value. When values run out, falls back to the previously defined implementation.

**Signature:**
```ts
mockRejectedValueOnce(value: any): Promise<MockObject>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `value` | `any` | Value to reject for the next call |

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await mockGetFileIcon.mockRejectedValue('default mocked icon error');
await mockGetFileIcon.mockRejectedValueOnce('first mocked icon error');
await mockGetFileIcon.mockRejectedValueOnce('second mocked icon error');

const getFileIcon = async () =>
  await browser.electron.execute(async (electron) => {
    try {
      await electron.app.getFileIcon('/path/to/icon');
    } catch (e) {
      return e;
    }
  });

let fileIcon = await getFileIcon();
expect(fileIcon).toBe('first mocked icon error');
fileIcon = await getFileIcon();
expect(fileIcon).toBe('second mocked icon error');
fileIcon = await getFileIcon();
expect(fileIcon).toBe('default mocked icon error');
```

---

### `mockClear()`

Clears the history of the mocked function. The mock implementation will not be reset.

**Signature:**
```ts
mockClear(): Promise<void>
```

**Returns:**

`Promise<void>`

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await browser.electron.execute((electron) => electron.app.getName());

await mockGetName.mockClear();

await browser.electron.execute((electron) => electron.app.getName());
expect(mockGetName).toHaveBeenCalledTimes(1);
```

---

### `mockReset()`

Resets the mocked function. The mock history will be cleared and the implementation will be reset to an empty function (returning undefined). Also resets all "once" implementations.

**Signature:**
```ts
mockReset(): Promise<void>
```

**Returns:**

`Promise<void>`

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');
await browser.electron.execute((electron) => electron.app.getName());

await mockGetName.mockReset();

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBeUndefined();
expect(mockGetName).toHaveBeenCalledTimes(1);
```

---

### `mockRestore()`

Restores the original implementation to the Electron API function.

**Signature:**
```ts
mockRestore(): Promise<void>
```

**Returns:**

`Promise<void>`

**Example:**

```ts
const appName = await browser.electron.execute((electron) => electron.app.getName());
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockReturnValue('mocked name');

await mockGetName.mockRestore();

const name = await browser.electron.execute((electron) => electron.app.getName());
expect(name).toBe(appName);
```

---

### `withImplementation()`

Overrides the original mock implementation temporarily while the callback is being executed. The electron object is passed into the callback in the same way as for [`execute()`](#execute).

**Signature:**
```ts
withImplementation(
  implementation: (...args: any[]) => any,
  callback: (electron) => any
): Promise<any>
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `implementation` | `(...args: any[]) => any` | Temporary implementation to use |
| `callback` | `(electron) => any` | Callback function to execute with temporary implementation |

**Returns:**

`Promise<any>` - Returns the result of the callback

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
const withImplementationResult = await mockGetName.withImplementation(
  () => 'temporary mock name',
  (electron) => electron.app.getName(),
);

expect(withImplementationResult).toBe('temporary mock name');

// Async callback
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');
const result = await mockGetFileIcon.withImplementation(
  () => Promise.resolve('temporary mock icon'),
  async (electron) => await electron.app.getFileIcon('/path/to/icon'),
);

expect(result).toBe('temporary mock icon');
```

---

### `getMockImplementation()`

Returns the current mock implementation if there is one.

**Signature:**
```ts
getMockImplementation(): Function | undefined
```

**Returns:**

`Function | undefined` - The current mock implementation function, or `undefined` if none is set

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
await mockGetName.mockImplementation(() => 'mocked name');
const mockImpl = mockGetName.getMockImplementation();

expect(mockImpl()).toBe('mocked name');
```

---

### `getMockName()`

Returns the assigned name of the mock. Defaults to `electron.<apiName>.<funcName>`.

**Signature:**
```ts
getMockName(): string
```

**Returns:**

`string` - The mock name

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');

expect(mockGetName.getMockName()).toBe('electron.app.getName');
```

---

### `mockName()`

Assigns a name to the mock. The name can be retrieved via [`getMockName()`](#getmockname).

**Signature:**
```ts
mockName(name: string): MockObject
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Name to assign to the mock |

**Returns:**

`MockObject` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');

mockGetName.mockName('test mock');

expect(mockGetName.getMockName()).toBe('test mock');
```

---

### `mockReturnThis()`

Useful if you need to return the `this` context from the method without invoking implementation. Shorthand for `mockImplementation(function () { return this; })`. Enables API functions to be chained.

**Signature:**
```ts
mockReturnThis(): Promise<MockObject>
```

**Returns:**

`Promise<MockObject>` - Returns the mock object for chaining

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
const mockGetVersion = await browser.electron.mock('app', 'getVersion');
await mockGetName.mockReturnThis();
await browser.electron.execute((electron) => electron.app.getName().getVersion());

expect(mockGetVersion).toHaveBeenCalled();
```

---

## Mock Object Properties

### `mock.calls`

An array containing all arguments for each call. Each item of the array is the arguments of that call.

**Type:**
```ts
Array<Array<any>>
```

**Example:**

```ts
const mockGetFileIcon = await browser.electron.mock('app', 'getFileIcon');

await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/icon'));
await browser.electron.execute((electron) => electron.app.getFileIcon('/path/to/another/icon', { size: 'small' }));

expect(mockGetFileIcon.mock.calls).toStrictEqual([
  ['/path/to/icon'], // first call
  ['/path/to/another/icon', { size: 'small' }], // second call
]);
```

---

### `mock.lastCall`

Contains the arguments of the last call. Returns `undefined` if the mock wasn't called.

**Type:**
```ts
Array<any> | undefined
```

**Example:**

```ts
const mockSetName = await browser.electron.mock('app', 'setName');

await browser.electron.execute((electron) => electron.app.setName('test'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test']);
await browser.electron.execute((electron) => electron.app.setName('test 2'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test 2']);
await browser.electron.execute((electron) => electron.app.setName('test 3'));
expect(mockSetName.mock.lastCall).toStrictEqual(['test 3']);
```

---

### `mock.results`

An array containing all values that were returned from the mock. Each item is an object with `type` and `value` properties.

**Type:**
```ts
Array<{ type: 'return' | 'throw', value: any }>
```

Available types:
- `'return'` - the mock returned without throwing
- `'throw'` - the mock threw a value

The `value` property contains the returned value or thrown error. If the mock returned a promise, the value will be the resolved value, not the Promise itself, unless it was never resolved.

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');

await mockGetName.mockImplementationOnce(() => 'result');
await mockGetName.mockImplementation(() => {
  throw new Error('thrown error');
});

await expect(browser.electron.execute((electron) => electron.app.getName())).resolves.toBe('result');
await expect(browser.electron.execute((electron) => electron.app.getName())).rejects.toThrow('thrown error');

expect(mockGetName.mock.results).toStrictEqual([
  {
    type: 'return',
    value: 'result',
  },
  {
    type: 'throw',
    value: new Error('thrown error'),
  },
]);
```

---

### `mock.invocationCallOrder`

The order of mock invocation. Returns an array of numbers that are shared between all defined mocks. Returns an empty array if the mock was never invoked.

**Type:**
```ts
Array<number>
```

**Example:**

```ts
const mockGetName = await browser.electron.mock('app', 'getName');
const mockGetVersion = await browser.electron.mock('app', 'getVersion');

await browser.electron.execute((electron) => electron.app.getName());
await browser.electron.execute((electron) => electron.app.getVersion());
await browser.electron.execute((electron) => electron.app.getName());

expect(mockGetName.mock.invocationCallOrder).toStrictEqual([1, 3]);
expect(mockGetVersion.mock.invocationCallOrder).toStrictEqual([2]);
```

---

## Electron Class Mock

Electron class mocks are returned when calling `browser.electron.mock()` with only a class name (no function name). They provide mocking capabilities for Electron classes like `Tray`, `BrowserWindow`, `Menu`, etc.

### Class Mock Properties

#### `__constructor`

An [ElectronMock](#mock-object-methods) object that tracks calls to the class constructor.

**Type:**
```ts
ElectronMock
```

**Example:**

```ts
const mockTray = await browser.electron.mock('Tray');

// Track constructor calls
await browser.electron.execute((electron) => {
  new electron.Tray('/path/to/icon.png');
  new electron.Tray('/path/to/other-icon.png');
});

expect(mockTray.__constructor).toHaveBeenCalledTimes(2);
expect(mockTray.__constructor.mock.calls).toStrictEqual([
  ['/path/to/icon.png'],
  ['/path/to/other-icon.png'],
]);
```

#### `[methodName]`

All instance methods of the class are available as [ElectronMock](#mock-object-methods) objects.

**Type:**
```ts
ElectronMock
```

**Example:**

```ts
const mockTray = await browser.electron.mock('Tray');

// Mock instance methods
await mockTray.setTitle.mockReturnValue(undefined);
await mockTray.setToolTip.mockReturnValue(undefined);

// Use in tests
await browser.electron.execute((electron) => {
  const tray = new electron.Tray('/path/to/icon.png');
  tray.setTitle('My App');
  tray.setToolTip('Click for menu');
});

expect(mockTray.setTitle).toHaveBeenCalledWith('My App');
expect(mockTray.setToolTip).toHaveBeenCalledWith('Click for menu');
```

### Class Mock Methods

#### `mockRestore()`

Restores the original Electron class, removing all mocks.

**Signature:**
```ts
mockRestore(): Promise<void>
```

**Returns:**

`Promise<void>`

**Example:**

```ts
const mockTray = await browser.electron.mock('Tray');

// Mock some behavior
await mockTray.setTitle.mockReturnValue(undefined);

// Restore original class
await mockTray.mockRestore();

// Original Tray class is now available
const tray = await browser.electron.execute((electron) => new electron.Tray('/path/to/icon.png'));
expect(tray).toBeDefined();
```
