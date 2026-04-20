/**
 * @wdio/native-spy - Standalone mock function implementation
 * Drop-in replacement for @vitest/spy
 */

import type { Mock, MockMetadata, MockResult } from './types.js';

let globalCallId = 0;

export interface FnOptions<T extends (...args: unknown[]) => unknown> {
  original?: T;
}

export function fn<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown>(
  implementation?: T,
  options?: FnOptions<T>,
): Mock<T> {
  let mockNameValue = '';
  let defaultReturnValue: ReturnType<T> | undefined;
  let defaultResolvedValue: Awaited<ReturnType<T>> | undefined;
  let defaultRejectedValue: unknown;
  let returnThis = false;
  let implementationFn = implementation;
  const originalFn = options?.original;
  const implementationQueue: T[] = [];

  // State that needs to be shared across calls
  const state: MockMetadata<T> = {
    calls: [],
    contexts: [],
    results: [],
    invocationCallOrder: [],
    instances: [],
  };

  const mockFn: Mock<T> = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    // Get next result from queue or defaults
    let result: MockResult;
    if (implementationQueue.length > 0) {
      const impl = implementationQueue.shift() as T;
      try {
        const value = impl(...(args as Parameters<T>));
        result = { type: 'return', value };
      } catch (error) {
        result = { type: 'throw', value: error };
      }
    } else if (defaultRejectedValue !== undefined) {
      result = { type: 'throw', value: defaultRejectedValue };
    } else if (defaultResolvedValue !== undefined) {
      result = { type: 'return', value: Promise.resolve(defaultResolvedValue) };
    } else if (returnThis) {
      result = { type: 'return', value: this };
    } else if (implementationFn !== undefined) {
      try {
        const value = implementationFn(...(args as Parameters<T>));
        result = { type: 'return', value };
      } catch (error) {
        result = { type: 'throw', value: error };
      }
    } else if (originalFn !== undefined) {
      try {
        const value = originalFn(...(args as Parameters<T>));
        result = { type: 'return', value };
      } catch (error) {
        result = { type: 'throw', value: error };
      }
    } else {
      result = { type: 'return', value: defaultReturnValue };
    }

    // Record the call (matches vitest's structure)
    const context = this === mockFn ? undefined : this;
    state.calls.push(args as Parameters<T>);
    state.contexts.push(context);
    state.invocationCallOrder.push(globalCallId++);

    if (result.type === 'throw') {
      state.results.push({ type: 'throw', value: result.value });
      throw result.value;
    }

    state.results.push({ type: 'return', value: result.value });
    return result.value as ReturnType<T>;
  } as Mock<T>;

  // Mark as mock function (vitest compatibility)
  (mockFn as unknown as { _isMockFunction: boolean })._isMockFunction = true;

  // Use direct value assignment (NOT getters) - matches vitest's approach
  // This is critical for CDP serialization to work correctly
  Object.defineProperty(mockFn, 'mock', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: state,
  });

  // These are convenience aliases that point to state properties
  // Using getters here is fine since they're not typically serialized directly
  Object.defineProperty(mockFn, 'calls', {
    get: () => state.calls,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'results', {
    get: () => state.results,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'invocationCallOrder', {
    get: () => state.invocationCallOrder,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'instances', {
    get: () => state.instances,
    enumerable: true,
    configurable: true,
  });

  // Attach all mock methods
  mockFn.mockName = function (this: Mock<T>, name: string): Mock<T> {
    mockNameValue = name;
    return this;
  };

  mockFn.getMockName = (): string => mockNameValue;

  mockFn.mockClear = function (this: Mock<T>): Mock<T> {
    state.calls = [];
    state.contexts = [];
    state.results = [];
    state.invocationCallOrder = [];
    state.instances = [];
    implementationQueue.length = 0;
    return this;
  };

  mockFn.mockReset = function (this: Mock<T>): Mock<T> {
    mockFn.mockClear();
    implementationFn = undefined;
    defaultReturnValue = undefined;
    defaultResolvedValue = undefined;
    defaultRejectedValue = undefined;
    returnThis = false;
    return this;
  };

  mockFn.mockRestore = function (this: Mock<T>): Mock<T> {
    mockFn.mockReset();
    // Restore to original function if available, otherwise just clear implementation
    implementationFn = originalFn;
    return this;
  };

  mockFn.mockImplementation = function (this: Mock<T>, fn: T): Mock<T> {
    implementationFn = fn;
    returnThis = false;
    return this;
  };

  mockFn.mockImplementationOnce = function (this: Mock<T>, fn: T): Mock<T> {
    implementationQueue.push(fn);
    return this;
  };

  mockFn.getMockImplementation = (): T | undefined => implementationFn;

  mockFn.mockReturnValue = function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
    defaultReturnValue = value;
    defaultResolvedValue = undefined;
    defaultRejectedValue = undefined;
    returnThis = false;
    return this;
  };

  mockFn.mockReturnValueOnce = function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
    implementationQueue.push((() => value) as T);
    return this;
  };

  mockFn.mockResolvedValue = function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
    defaultResolvedValue = value;
    defaultReturnValue = undefined;
    defaultRejectedValue = undefined;
    returnThis = false;
    return this;
  };

  mockFn.mockResolvedValueOnce = function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
    implementationQueue.push((async () => value) as T);
    return this;
  };

  mockFn.mockRejectedValue = function (this: Mock<T>, reason: unknown): Mock<T> {
    defaultRejectedValue = reason;
    defaultReturnValue = undefined;
    defaultResolvedValue = undefined;
    returnThis = false;
    return this;
  };

  mockFn.mockRejectedValueOnce = function (this: Mock<T>, reason: unknown): Mock<T> {
    implementationQueue.push((async () => {
      throw reason;
    }) as T);
    return this;
  };

  mockFn.mockReturnThis = function (this: Mock<T>): Mock<T> {
    returnThis = true;
    defaultReturnValue = undefined;
    defaultResolvedValue = undefined;
    defaultRejectedValue = undefined;
    return this;
  };

  mockFn.withImplementation = function <R>(this: Mock<T>, fn: T, callback: () => R): Awaited<ReturnType<T>> {
    const originalImplementation = implementationFn;
    const originalQueue = [...implementationQueue];
    const originalReturnThis = returnThis;

    implementationFn = fn;
    implementationQueue.length = 0;
    returnThis = false;

    try {
      const result = callback() as Awaited<ReturnType<T>>;
      return result;
    } finally {
      implementationFn = originalImplementation;
      implementationQueue.splice(0, implementationQueue.length, ...originalQueue);
      returnThis = originalReturnThis;
    }
  };

  return mockFn;
}
