import { fn as vitestFn } from '@vitest/spy';
import type { AbstractFn, TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'mock');

async function restoreTauriCommand(command: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;

  // Call the injection script's restore function
  await browserToUse.execute<void, [string]>((cmd) => {
    // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
    if (window.__wdio_mocks__ && window.__wdio_mocks__[cmd]) {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      delete window.__wdio_mocks__[cmd];
    }
  }, command);

  // Also clear from Rust plugin store
  await browserToUse.tauri.execute<void, [string]>(async (invoke, cmd) => {
    // @ts-expect-error - invoke is available in execute context
    await invoke('plugin:wdio|set_mock', {
      command: cmd,
      config: { command: cmd, return_value: null, implementation: null },
    });
  }, command);
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

  // Use provided browser context or fallback to global browser
  const browserToUse: WebdriverIO.Browser = (browserContext || browser) as WebdriverIO.Browser;

  log.debug(`[${command}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  // Initialize inner (WebView) mock via injection script
  await browserToUse.execute<void, [string]>(async (cmd) => {
    const { fn } = await import('@vitest/spy');
    const mockFn = fn();
    mockFn.mockName(`tauri.${cmd}`);

    // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
    if (!window.__wdio_mocks__) {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      window.__wdio_mocks__ = {};
    }
    // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
    window.__wdio_mocks__[cmd] = mockFn;
  }, command);

  mock.update = async () => {
    log.debug(`[${command}] Starting mock update`);
    // Synchronize inner and outer mocks
    const calls = (await browserToUse.execute((cmd: string) => {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      const mockObj = window.__wdio_mocks__?.[cmd];
      return mockObj?.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock.calls)) : [];
    }, command)) as unknown as unknown[][];

    log.debug(
      `[${command}] Retrieved ${calls.length} calls from inner mock, outer mock has ${originalMock.calls.length} calls`,
    );

    // Re-apply calls from the WebView mock to the outer one
    if (originalMock.calls.length < calls.length) {
      log.debug(`[${command}] Applying ${calls.length - originalMock.calls.length} new calls to outer mock`);
      calls.forEach((call: unknown[], index: number) => {
        if (!originalMock.calls[index]) {
          log.debug(`[${command}] Applying call ${index}:`, call);
          mock?.apply(mock, call);
        }
      });
    } else {
      log.debug(`[${command}] No new calls to synchronize`);
    }

    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    await browserToUse.execute<void, [string, string]>(
      (cmd, mockImplementationStr) => {
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

    // Update Rust plugin store
    await browserToUse.tauri.execute<void, [string, string]>(
      async (invoke, cmd, implementation) => {
        // @ts-expect-error - invoke is available in execute context
        await invoke('plugin:wdio|set_mock', {
          command: cmd,
          config: { command: cmd, implementation },
        });
      },
      command,
      implFn.toString(),
    );

    outerMockImplementation(implFn);

    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await browserToUse.execute<void, [string, string]>(
      (cmd, mockImplementationStr) => {
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
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, returnValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockReturnValue(returnValue);
        }
      },
      command,
      value,
    );

    // Update Rust plugin store
    await browserToUse.tauri.execute<void, [string, unknown]>(
      async (invoke, cmd, returnValue) => {
        // @ts-expect-error - invoke is available in execute context
        await invoke('plugin:wdio|set_mock', {
          command,
          config: { cmd, return_value: returnValue },
        });
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, returnValue) => {
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
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, resolvedValue) => {
        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.mockResolvedValue(resolvedValue);
        }
      },
      command,
      value,
    );

    // Update Rust plugin store
    await browserToUse.tauri.execute<void, [string, unknown]>(
      async (invoke, cmd, resolvedValue) => {
        // @ts-expect-error - invoke is available in execute context
        await invoke('plugin:wdio|set_mock', {
          command,
          config: { cmd, return_value: resolvedValue },
        });
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, resolvedValue) => {
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
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, rejectedValue) => {
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
    await browserToUse.execute<void, [string, unknown]>(
      (cmd, rejectedValue) => {
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
    await browserToUse.execute<void, [string]>((cmd) => {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      const mockObj = window.__wdio_mocks__?.[cmd];
      if (mockObj) {
        mockObj.mockClear();
      }
    }, command);
    outerMockClear();

    return mock;
  };

  mock.mockReset = async () => {
    // Reset inner implementation to an empty function and clear mock history
    await browserToUse.execute<void, [string]>((cmd) => {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      const mockObj = window.__wdio_mocks__?.[cmd];
      if (mockObj) {
        mockObj.mockReset();
      }
    }, command);
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
    return await browserToUse.execute<void, [string]>((cmd) => {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      const mockObj = window.__wdio_mocks__?.[cmd];
      if (mockObj) {
        mockObj.mockReturnThis();
      }
    }, command);
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await browserToUse.execute<unknown, [string, string, string]>(
      async (cmd, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)();
        const impl = new Function(`return ${implFnStr}`)();
        let result: unknown | Promise<unknown>;

        // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          mockObj.withImplementation(impl, () => {
            // @ts-expect-error - window.__TAURI__ is available
            result = callback(window.__TAURI__);
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
