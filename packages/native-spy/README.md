# @wdio/native-spy

Minimal mock function implementation for WebdriverIO Native Desktop Services.

## Overview

This package provides a lightweight mock/spy implementation (`fn()`) for use in Electron and Tauri desktop testing scenarios where `@vitest/spy` cannot be bundled directly into the application context.

## Usage

```typescript
import { fn } from '@wdio/native-spy';

// Create a mock function
const mock = fn();

// Set return values
mock.mockReturnValue('hello');
console.log(mock()); // 'hello'

// Track calls
mock('world');
console.log(mock.calls.length); // 1
console.log(mock.calls[0].args); // ['world']
```

## API

### `fn<T>(implementation?)`

Creates a mock function with the optional implementation.

### Mock Methods

- `mockReturnValue(value)` - Set return value
- `mockReturnValueOnce(value)` - Set return value for next call
- `mockResolvedValue(value)` - Set resolved value (for async functions)
- `mockResolvedValueOnce(value)` - Set resolved value for next call
- `mockRejectedValue(reason)` - Set rejection error
- `mockRejectedValueOnce(reason)` - Set rejection error for next call
- `mockImplementation(fn)` - Set implementation function
- `mockImplementationOnce(fn)` - Set implementation for next call
- `mockClear()` - Clear call history
- `mockReset()` - Reset to initial state
- `mockRestore()` - Restore original implementation
- `mockName(name)` - Set mock name
- `getMockName()` - Get mock name

### Mock Properties

- `calls` - Array of call information
- `results` - Array of call results
- `invocationCallOrder` - Order of invocations
- `instances` - Array of instances (for constructor mocks)

## License

MIT
