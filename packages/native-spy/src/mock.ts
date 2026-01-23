import type { Mock, MockMetadata, MockResult } from './types.js';

let globalCallId = 0;

/**
 * Create the mock function with all methods
 */
export function createMock<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown>(
  implementation?: T,
): Mock<T> {
  let mockNameValue = '';
  let defaultReturnValue: ReturnType<T> | undefined;
  let defaultResolvedValue: Awaited<ReturnType<T>> | undefined;
  let defaultRejectedValue: unknown;
  let returnThis = false;
  let isConstructor = false;
  let implementationFn = implementation;
  const implementationQueue: T[] = [];

  // State that needs to be shared across calls
  const state: MockMetadata<T> = {
    calls: [],
    results: [],
    invocationCallOrder: [],
    instances: [],
  };

  const mockFn: Mock<T> = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    // Handle constructor case
    if (isConstructor) {
      const Constructor = function (this: unknown, ...ctorArgs: Parameters<T>) {
        const result = mockFn(...ctorArgs);
        if (typeof result === 'object' && result !== null) {
          Object.setPrototypeOf(result, Object.getPrototypeOf(this));
        }
        return result;
      } as T;

      Constructor.prototype = Object.create(implementationFn?.prototype || null);
      state.instances.push(Constructor as T);
      return Constructor as ReturnType<T>;
    }

    // Get next result from queue or defaults
    let result: MockResult;
    if (implementationQueue.length > 0) {
      const impl = implementationQueue.shift()!;
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
    } else {
      result = { type: 'return', value: defaultReturnValue };
    }

    // Record the call - avoid circular reference by not storing the mock function as 'this'
    const callThis = this === mockFn ? undefined : this;
    state.calls.push({ this: callThis as unknown, args: args as Parameters<T> });
    state.invocationCallOrder.push(globalCallId++);

    if (result.type === 'throw') {
      state.results.push({ type: 'throw', value: result.value });
      throw result.value;
    }

    state.results.push({ type: 'return', value: result.value });
    return result.value as ReturnType<T>;
  } as Mock<T>;

  // Attach all mock methods as non-enumerable properties
  // This prevents them from being serialized and causing circular reference issues
  Object.defineProperty(mockFn, 'mockName', {
    value: function (this: Mock<T>, name: string): Mock<T> {
      mockNameValue = name;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'getMockName', {
    value: (): string => mockNameValue,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockClear', {
    value: function (this: Mock<T>): Mock<T> {
      state.calls = [];
      state.results = [];
      state.invocationCallOrder = [];
      state.instances = [];
      implementationQueue.length = 0;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockReset', {
    value: function (this: Mock<T>): Mock<T> {
      mockFn.mockClear();
      implementationFn = undefined;
      defaultReturnValue = undefined;
      defaultResolvedValue = undefined;
      defaultRejectedValue = undefined;
      isConstructor = false;
      returnThis = false;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockRestore', {
    value: function (this: Mock<T>): Mock<T> {
      mockFn.mockReset();
      implementationFn = undefined;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockImplementation', {
    value: function (this: Mock<T>, fn: T): Mock<T> {
      implementationFn = fn;
      returnThis = false;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockImplementationOnce', {
    value: function (this: Mock<T>, fn: T): Mock<T> {
      implementationQueue.push(fn);
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockReturnValue', {
    value: function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
      defaultReturnValue = value;
      defaultResolvedValue = undefined;
      defaultRejectedValue = undefined;
      returnThis = false;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockReturnValueOnce', {
    value: function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
      implementationQueue.push((() => value) as T);
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockResolvedValue', {
    value: function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
      defaultResolvedValue = value;
      defaultReturnValue = undefined;
      defaultRejectedValue = undefined;
      returnThis = false;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockResolvedValueOnce', {
    value: function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
      implementationQueue.push((async () => value) as T);
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockRejectedValue', {
    value: function (this: Mock<T>, reason: unknown): Mock<T> {
      defaultRejectedValue = reason;
      defaultReturnValue = undefined;
      defaultResolvedValue = undefined;
      returnThis = false;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockRejectedValueOnce', {
    value: function (this: Mock<T>, reason: unknown): Mock<T> {
      implementationQueue.push((async () => {
        throw reason;
      }) as T);
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'mockReturnThis', {
    value: function (this: Mock<T>): Mock<T> {
      returnThis = true;
      defaultReturnValue = undefined;
      defaultResolvedValue = undefined;
      defaultRejectedValue = undefined;
      return this;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'withImplementation', {
    value: function <R>(this: Mock<T>, fn: T, callback: () => R): Awaited<ReturnType<T>> {
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
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  // Make properties read-only (using Object.defineProperty)
  // These properties are non-enumerable to prevent circular reference issues
  // when the mock is serialized (e.g., via JSON.stringify in CDP bridge)
  Object.defineProperty(mockFn, 'calls', {
    get: () => state.calls,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'results', {
    get: () => state.results,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'invocationCallOrder', {
    get: () => state.invocationCallOrder,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'instances', {
    get: () => state.instances,
    enumerable: false,
    configurable: true,
  });

  // Mock metadata (non-circular, safe for CDP serialization)
  // Non-enumerable to prevent serialization issues
  Object.defineProperty(mockFn, 'mock', {
    get: () => state,
    enumerable: false,
    configurable: true,
  });

  return mockFn;
}
