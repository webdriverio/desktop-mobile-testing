import { fn as vitestFn } from '@vitest/spy';
import type { AbstractFn, TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { execute as tauriExecute } from './commands/execute.js';

const log = createLogger('tauri-service', 'mock');

/**
 * Internal mock state structure that allows writing to vitest mock properties.
 * Vitest types define these as readonly, but we need to mutate them when syncing
 * state from the browser-side mock to the Node.js-side mock.
 */
interface WritableMockState {
  calls: unknown[][];
  results: unknown[];
  invocationCallOrder: number[];
  lastCall?: unknown;
}

async function restoreTauriCommand(command: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;

  // Call the injection script's restore function
  await tauriExecute<void, [string]>(
    browserToUse,
    (_tauri, cmd) => {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      if (window.__wdio_mocks__?.[cmd]) {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        delete window.__wdio_mocks__[cmd];
      }
    },
    command,
  );
}

export async function createMock(command: string, browserContext?: WebdriverIO.Browser): Promise<TauriMock> {
  log.debug(`[${command}] createMock called - starting mock creation`);
  const outerMock = vitestFn();
  const outerMockImplementation = outerMock.mockImplementation;
  const outerMockImplementationOnce = outerMock.mockImplementationOnce;
  const outerMockClear = outerMock.mockClear;
  const outerMockReset = outerMock.mockReset;

  outerMock.mockName(`tauri.${command}`);

  const mock = outerMock as unknown as TauriMock;

  mock.__isTauriMock = true;

  // Store the original mock property for later auto-update setup
  const originalMock = outerMock.mock;

  log.debug(`[${command}] Creating auto-updating mock wrapper object`);

  // Create a wrapper function that delegates to the original mock function
  const wrapperMock = ((...args: unknown[]) => {
    return (mock as (...args: unknown[]) => unknown)(...args);
  }) as TauriMock;

  // Copy all properties and methods from the original mock to the wrapper
  Object.setPrototypeOf(wrapperMock, Object.getPrototypeOf(mock));
  Object.getOwnPropertyNames(mock).forEach((key) => {
    if (key !== 'mock' && key !== 'length' && key !== 'name') {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(mock, key);
        if (descriptor) {
          Object.defineProperty(wrapperMock, key, descriptor);
        }
      } catch (_error) {
        // Skip properties that can't be copied
      }
    }
  });

  // Expose the original vitest mock state on the wrapper for matcher compatibility
  Object.defineProperty(wrapperMock, 'mock', {
    configurable: false,
    enumerable: false,
    get() {
      return originalMock;
    },
  });

  // Also expose mock properties directly on the wrapper for convenience
  // These will be updated by the update() method
  Object.defineProperty(wrapperMock, 'calls', {
    get() {
      return originalMock.calls;
    },
  });

  Object.defineProperty(wrapperMock, 'results', {
    get() {
      return originalMock.results;
    },
  });

  Object.defineProperty(wrapperMock, 'invocationCallOrder', {
    get() {
      return originalMock.invocationCallOrder;
    },
  });

  Object.defineProperty(wrapperMock, 'lastCall', {
    get() {
      return originalMock.lastCall;
    },
  });

  // Use provided browser context or fallback to global browser
  const browserToUse: WebdriverIO.Browser = (browserContext || browser) as WebdriverIO.Browser;

  log.debug(`[${command}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  // Initialize inner (WebView) mock via injection script
  log.debug(`[${command}] Setting up JavaScript mock`);
  await tauriExecute<void, [string]>(
    browserToUse,
    (_tauri, cmd) => {
      console.log(`[WDIO Service] Setting up mock for command: ${cmd}`);
      // @ts-expect-error - window.__vitest_spy__ is exposed by the app
      const spy = window.__vitest_spy__;
      if (!spy || !spy.fn) {
        console.error('[WDIO Service] Vitest spy not available');
        throw new Error(
          'Vitest spy not available. Make sure @vitest/spy is imported and exposed as window.__vitest_spy__ in your app.',
        );
      }

      console.log('[WDIO Service] Creating mock function');
      const mockFn = spy.fn();
      mockFn.mockName(`tauri.${cmd}`);

      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      if (!window.__wdio_mocks__) {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        window.__wdio_mocks__ = {};
      }
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      window.__wdio_mocks__[cmd] = mockFn;
      console.log(`[WDIO Service] Mock set up for command: ${cmd}`);
    },
    command,
  );
  log.debug(`[${command}] JavaScript mock setup complete`);

  mock.update = async () => {
    log.debug(`[${command}] Starting mock update`);
    // Get mock state directly from JavaScript mock
    const mockState = await tauriExecute<
      {
        calls: unknown[][];
        results: unknown[];
        invocationCallOrder: number[];
        lastCall?: unknown;
      } | null,
      [string]
    >(
      browserToUse,
      (_tauri, cmd: string) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (!mockObj?.mock) return null;

        return {
          calls: JSON.parse(JSON.stringify(mockObj.mock.calls || [])),
          results: JSON.parse(JSON.stringify(mockObj.mock.results || [])),
          invocationCallOrder: JSON.parse(JSON.stringify(mockObj.mock.invocationCallOrder || [])),
          lastCall: mockObj.mock.lastCall ? JSON.parse(JSON.stringify(mockObj.mock.lastCall)) : undefined,
        };
      },
      command,
    );

    if (mockState) {
      log.debug(
        `[${command}] Updating mock state: ${mockState.calls.length} calls, ${mockState.results.length} results`,
      );

      // Copy state directly to the outer mock
      // Cast to WritableMockState to allow mutation (vitest types are readonly)
      const writableMock = originalMock as unknown as WritableMockState;
      writableMock.calls = mockState.calls;
      writableMock.results = mockState.results;
      writableMock.invocationCallOrder = mockState.invocationCallOrder;
      writableMock.lastCall = mockState.lastCall;
    } else {
      log.debug(`[${command}] No mock state to update`);
    }

    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    await tauriExecute<void, [string, string]>(
      browserToUse,
      (_tauri, cmd, mockImplementationStr) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          const mockImpl = new Function(`return ${mockImplementationStr}`)();
          mockObj.mockImplementation(mockImpl);
        }
      },
      command,
      implFn.toString(),
    );

    outerMockImplementation(implFn);

    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await tauriExecute<void, [string, string]>(
      browserToUse,
      (_tauri, cmd, mockImplementationStr) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          const mockImpl = new Function(`return ${mockImplementationStr}`)();
          mockObj.mockImplementationOnce(mockImpl);
        }
      },
      command,
      implFn.toString(),
    );
    outerMockImplementationOnce(implFn);

    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, returnValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockReturnValue(returnValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, returnValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockReturnValueOnce(returnValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, resolvedValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockResolvedValue(resolvedValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, resolvedValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockResolvedValueOnce(resolvedValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, rejectedValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockRejectedValue(rejectedValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, rejectedValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockRejectedValueOnce(rejectedValue);
        }
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockClear = async () => {
    // Clear mock history
    await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockClear();
        }
      },
      command,
    );
    outerMockClear();

    return mock;
  };

  mock.mockReset = async () => {
    // Reset inner implementation to an empty function and clear mock history
    await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockReset();
        }
      },
      command,
    );
    outerMockReset();

    // Vitest mockReset doesn't clear mock history so we need to explicitly clear both mocks
    await mock.mockClear();

    return mock;
  };

  mock.mockRestore = async () => {
    // Restore inner mock implementation to the original function
    await restoreTauriCommand(command, browserToUse);

    // Clear mocks
    outerMockClear();
    await mock.mockClear();

    return mock;
  };

  mock.mockReturnThis = async () => {
    return await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockReturnThis();
        }
      },
      command,
    );
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await tauriExecute<unknown, [string, string, string]>(
      browserToUse,
      async (tauri, cmd, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)();
        const impl = new Function(`return ${implFnStr}`)();
        let result: unknown | Promise<unknown>;

        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.withImplementation(impl, () => {
            // Use the tauri parameter passed in
            result = callback(tauri);
          });
        }

        return (result as Promise<unknown>)?.then ? await result : result;
      },
      command,
      implFn.toString(),
      callbackFn.toString(),
    );
  };

  // Ensure all mock methods are properly bound to the wrapper
  wrapperMock.mockImplementation = mock.mockImplementation.bind(mock);
  wrapperMock.mockImplementationOnce = mock.mockImplementationOnce.bind(mock);
  wrapperMock.mockReturnValue = mock.mockReturnValue.bind(mock);
  wrapperMock.mockReturnValueOnce = mock.mockReturnValueOnce.bind(mock);
  wrapperMock.mockResolvedValue = mock.mockResolvedValue.bind(mock);
  wrapperMock.mockResolvedValueOnce = mock.mockResolvedValueOnce.bind(mock);
  wrapperMock.mockRejectedValue = mock.mockRejectedValue.bind(mock);
  wrapperMock.mockRejectedValueOnce = mock.mockRejectedValueOnce.bind(mock);
  wrapperMock.mockClear = mock.mockClear.bind(mock);
  wrapperMock.mockReset = mock.mockReset.bind(mock);
  wrapperMock.mockRestore = mock.mockRestore.bind(mock);
  wrapperMock.mockReturnThis = mock.mockReturnThis.bind(mock);
  wrapperMock.withImplementation = mock.withImplementation.bind(mock);
  wrapperMock.update = mock.update.bind(mock);

  // Set additional properties
  wrapperMock.__isTauriMock = true;

  log.debug(`[${command}] Auto-updating mock wrapper created successfully`);

  // Return the wrapper instead of the original mock
  return wrapperMock;
}
