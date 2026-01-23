import type { Mock, MockInstance, MockResult, MockState } from './types.js';

let globalCallId = 0;

/**
 * Create a mock instance with all state tracking
 */
function createMockInstance<T extends (...args: unknown[]) => unknown>(implementation?: T): MockInstance<T> {
  const state: MockState<T> = {
    calls: [],
    results: [],
    invocationCallOrder: [],
    instances: [],
  };

  return {
    mock: {} as Mock<T>,
    state,
    implementation,
    implementationQueue: [],
    defaultReturnValue: undefined,
    defaultResolvedValue: undefined,
    defaultRejectedValue: undefined,
    isConstructor: false,
    returnThis: false,
  };
}

/**
 * Get the next result from the implementation queue, or use default
 */
function getNextResult<T extends (...args: unknown[]) => unknown>(
  instance: MockInstance<T>,
  args: unknown[],
  callThis: unknown,
): MockResult {
  // Check implementation queue first
  if (instance.implementationQueue.length > 0) {
    const implementation = instance.implementationQueue.shift()!;

    try {
      const result = implementation(...(args as Parameters<T>));
      return { type: 'return' as const, value: result };
    } catch (error) {
      return { type: 'throw' as const, value: error };
    }
  }

  // Check for explicit rejections
  if (instance.defaultRejectedValue !== undefined) {
    return { type: 'throw' as const, value: instance.defaultRejectedValue };
  }

  // Check for explicit resolved values
  if (instance.defaultResolvedValue !== undefined) {
    return { type: 'return' as const, value: Promise.resolve(instance.defaultResolvedValue) };
  }

  // Check for mockReturnThis
  if (instance.returnThis) {
    return { type: 'return' as const, value: callThis };
  }

  // Use the base implementation if set
  if (instance.implementation !== undefined) {
    try {
      const result = instance.implementation(...(args as Parameters<T>));
      return { type: 'return' as const, value: result };
    } catch (error) {
      return { type: 'throw' as const, value: error };
    }
  }

  // Default return value
  return { type: 'return' as const, value: instance.defaultReturnValue };
}

/**
 * Create the mock function with all methods
 */
export function createMock<T extends (...args: unknown[]) => unknown = (...args: unknown[]) => unknown>(
  implementation?: T,
): Mock<T> {
  const instance = createMockInstance<T>(implementation);
  let mockNameValue = '';

  const mockFn: Mock<T> = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    // Handle constructor case
    if (instance.isConstructor) {
      const Constructor = function (this: unknown, ...ctorArgs: Parameters<T>) {
        const result = instance.mock(...ctorArgs);
        if (typeof result === 'object' && result !== null) {
          Object.setPrototypeOf(result, Object.getPrototypeOf(this));
        }
        return result;
      } as T;

      Constructor.prototype = Object.create(implementation?.prototype || null);
      instance.state.instances.push(Constructor as T);
      return Constructor as ReturnType<T>;
    }

    const result = getNextResult(instance, args, this);

    // Record the call
    instance.state.calls.push({ this: this as unknown, args: args as Parameters<T> });
    instance.state.invocationCallOrder.push(globalCallId++);

    if (result.type === 'throw') {
      instance.state.results.push({ type: 'throw', value: result.value });
      throw result.value;
    }

    instance.state.results.push({ type: 'return', value: result.value });
    return result.value as ReturnType<T>;
  } as Mock<T>;

  // Attach all mock methods
  mockFn.mockName = function (this: Mock<T>, name: string): Mock<T> {
    mockNameValue = name;
    return this;
  };

  mockFn.getMockName = (): string => mockNameValue;

  mockFn.mockClear = function (this: Mock<T>): Mock<T> {
    instance.state.calls = [];
    instance.state.results = [];
    instance.state.invocationCallOrder = [];
    instance.state.instances = [];
    instance.implementationQueue = [];
    return this;
  };

  mockFn.mockReset = function (this: Mock<T>): Mock<T> {
    mockFn.mockClear();
    instance.implementation = undefined;
    instance.defaultReturnValue = undefined;
    instance.defaultResolvedValue = undefined;
    instance.defaultRejectedValue = undefined;
    instance.isConstructor = false;
    instance.returnThis = false;
    return this;
  };

  mockFn.mockRestore = function (this: Mock<T>): Mock<T> {
    mockFn.mockReset();
    instance.implementation = undefined;
    return this;
  };

  mockFn.mockImplementation = function (this: Mock<T>, fn: T): Mock<T> {
    instance.implementation = fn;
    instance.returnThis = false;
    return this;
  };

  mockFn.mockImplementationOnce = function (this: Mock<T>, fn: T): Mock<T> {
    instance.implementationQueue.push(fn);
    return this;
  };

  mockFn.mockReturnValue = function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
    instance.defaultReturnValue = value;
    instance.defaultResolvedValue = undefined;
    instance.defaultRejectedValue = undefined;
    instance.returnThis = false;
    return this;
  };

  mockFn.mockReturnValueOnce = function (this: Mock<T>, value: ReturnType<T>): Mock<T> {
    instance.implementationQueue.push((() => value) as T);
    return this;
  };

  mockFn.mockResolvedValue = function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
    instance.defaultResolvedValue = value;
    instance.defaultReturnValue = undefined;
    instance.defaultRejectedValue = undefined;
    instance.returnThis = false;
    return this;
  };

  mockFn.mockResolvedValueOnce = function (this: Mock<T>, value: Awaited<ReturnType<T>>): Mock<T> {
    instance.implementationQueue.push((async () => value) as T);
    return this;
  };

  mockFn.mockRejectedValue = function (this: Mock<T>, reason: unknown): Mock<T> {
    instance.defaultRejectedValue = reason;
    instance.defaultReturnValue = undefined;
    instance.defaultResolvedValue = undefined;
    instance.returnThis = false;
    return this;
  };

  mockFn.mockRejectedValueOnce = function (this: Mock<T>, reason: unknown): Mock<T> {
    instance.implementationQueue.push((async () => {
      throw reason;
    }) as T);
    return this;
  };

  mockFn.mockReturnThis = function (this: Mock<T>): Mock<T> {
    instance.returnThis = true;
    instance.defaultReturnValue = undefined;
    instance.defaultResolvedValue = undefined;
    instance.defaultRejectedValue = undefined;
    return this;
  };

  mockFn.withImplementation = function <R>(this: Mock<T>, fn: T, callback: () => R): Awaited<ReturnType<T>> {
    const originalImplementation = instance.implementation;
    const originalQueue = [...instance.implementationQueue];
    const originalReturnThis = instance.returnThis;

    instance.implementation = fn;
    instance.implementationQueue = [];
    instance.returnThis = false;

    try {
      const result = callback() as Awaited<ReturnType<T>>;
      return result;
    } finally {
      instance.implementation = originalImplementation;
      instance.implementationQueue = originalQueue;
      instance.returnThis = originalReturnThis;
    }
  };

  // Make properties read-only (using Object.defineProperty)
  Object.defineProperty(mockFn, 'calls', {
    get: () => instance.state.calls,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'results', {
    get: () => instance.state.results,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'invocationCallOrder', {
    get: () => instance.state.invocationCallOrder,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(mockFn, 'instances', {
    get: () => instance.state.instances,
    enumerable: true,
    configurable: true,
  });

  return mockFn;
}
