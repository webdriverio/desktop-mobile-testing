import { type Mock, fn as vitestFn } from '@wdio/native-spy';
import type {
  AbstractFn,
  ElectronApiFn,
  ElectronClassMock,
  ElectronFunctionMock,
  ElectronInterface,
  ElectronType,
  ExecuteOpts,
} from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import mockStore from './mockStore.js';

const log = createLogger('electron-service', 'mock');

async function restoreElectronFunctionality(apiName: string, funcName: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;
  const result = await browserToUse.electron.execute<string, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      try {
        const electronApi = electron[apiName as keyof typeof electron] as unknown as Record<
          string,
          { mockRestore?: () => void }
        >;
        const fn = electronApi[funcName];

        if (fn?.mockRestore) {
          fn.mockRestore();
          return 'SUCCESS_MOCK_RESTORE';
        }

        const originalApi = globalThis.originalApi as unknown as Record<string, Record<string, () => unknown>>;
        const originalFn = originalApi?.[apiName]?.[funcName];
        if (originalFn) {
          const targetApi = electron[apiName as keyof typeof electron] as unknown as Record<string, () => unknown>;
          targetApi[funcName] = originalFn;
          return 'SUCCESS_FALLBACK';
        }

        return 'NO_RESTORE_AVAILABLE';
      } catch (e) {
        return `ERROR: ${String(e)}`;
      }
    },
    apiName,
    funcName,
    { internal: true },
  );
  log.debug(`[${apiName}.${funcName}] restoreElectronFunctionality result:`, result);
  return result;
}

export async function createMock(
  apiName: string,
  funcName: string,
  browserContext?: WebdriverIO.Browser,
): Promise<ElectronFunctionMock> {
  log.debug(`[${apiName}.${funcName}] createMock called - starting mock creation`);
  const outerMock = vitestFn();
  const outerMockImplementation = outerMock.mockImplementation;
  const outerMockImplementationOnce = outerMock.mockImplementationOnce;
  const outerMockClear = outerMock.mockClear;
  const outerMockReset = outerMock.mockReset;

  outerMock.mockName(`electron.${apiName}.${funcName}`);

  const mock = outerMock as unknown as ElectronFunctionMock;

  mock.__isElectronMock = true;

  // Store the original mock property for later auto-update setup
  const originalMock = outerMock.mock;

  // APPROACH: Wrapper Object Strategy
  // Since we can't modify the Vitest mock's 'mock' property (it's non-configurable),
  // we'll create a wrapper object that provides auto-updating functionality

  log.debug(`[${apiName}.${funcName}] Creating auto-updating mock wrapper object`);

  // Create a wrapper function that delegates to the original mock function
  // but also provides auto-updating mock data
  const wrapperMock = ((...args: unknown[]) => {
    // Delegate to the original mock function
    return (mock as (...args: unknown[]) => unknown)(...args);
  }) as ElectronFunctionMock;

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

  // Also expose lastCall for convenience (computed from calls)
  Object.defineProperty(wrapperMock, 'lastCall', {
    configurable: true,
    enumerable: true,
    get() {
      return originalMock.calls[originalMock.calls.length - 1];
    },
  });

  // Use provided browser context or fallback to global browser
  const browserToUse = browserContext || browser;

  log.debug(`[${apiName}.${funcName}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  // First, capture the original function and store in globalThis.originalApi
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron] as unknown as Record<string, () => unknown>;
      const originalFn = electronApi[funcName];

      if (originalFn) {
        // Store in globalThis.originalApi for restore fallback
        const globalOrigApi = globalThis as unknown as Record<string, Record<string, Record<string, () => unknown>>>;
        if (!globalOrigApi.originalApi) {
          globalOrigApi.originalApi = {};
        }
        if (!globalOrigApi.originalApi[apiName]) {
          globalOrigApi.originalApi[apiName] = {};
        }
        globalOrigApi.originalApi[apiName][funcName] = originalFn;
      }
    },
    apiName,
    funcName,
    { internal: true },
  );

  // initialise inner (Electron) mock
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    async (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];
      const spy = await import('@wdio/native-spy');

      // Try to get original from globalThis.originalApi
      const originalApi = globalThis.originalApi as unknown as Record<string, Record<string, () => unknown>>;
      const originalFn = originalApi?.[apiName]?.[funcName];

      const mockFn = spy.fn(
        function (this: unknown) {
          return undefined;
        },
        { original: originalFn },
      );

      // replace target API with mock
      electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
    },
    apiName,
    funcName,
    { internal: true },
  );

  mock.update = async () => {
    log.debug(`[${apiName}.${funcName}] Starting mock update`);
    // synchronises inner and outer mocks
    const calls =
      (await browserToUse.electron.execute<unknown[][], [string, string, ExecuteOpts]>(
        (electron, apiName, funcName) => {
          const api = electron[apiName as keyof typeof electron];
          if (!api) return [];
          const mockObj = api[funcName as keyof ElectronType[ElectronInterface]] as ElectronFunctionMock;
          return mockObj?.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock?.calls)) : [];
        },
        apiName,
        funcName,
        { internal: true },
      )) ?? [];

    log.debug(
      `[${apiName}.${funcName}] Retrieved ${calls.length} calls from inner mock, outer mock has ${originalMock.calls.length} calls`,
    );

    // re-apply calls from the electron main process mock to the outer one
    if (originalMock.calls.length < calls.length) {
      log.debug(
        `[${apiName}.${funcName}] Applying ${calls.length - originalMock.calls.length} new calls to outer mock`,
      );
      calls.forEach((call: unknown[], index: number) => {
        if (!originalMock.calls[index]) {
          log.debug(`[${apiName}.${funcName}] Applying call ${index}:`, call);
          mock?.apply(mock, call);
        }
      });
    } else {
      log.debug(`[${apiName}.${funcName}] No new calls to synchronize`);
    }

    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, apiName, funcName, mockImplementationStr) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const mockImpl = new Function(`return ${mockImplementationStr}`)() as AbstractFn;
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockImplementation(mockImpl);
      },
      apiName,
      funcName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementation(implFn);

    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, apiName, funcName, mockImplementationStr) => {
        const electronApi = electron[apiName as keyof typeof electron];
        const mockImpl = new Function(`return ${mockImplementationStr}`)() as AbstractFn;
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockImplementationOnce(mockImpl);
      },
      apiName,
      funcName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementationOnce(implFn);

    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockReturnValue(returnValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, returnValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockReturnValueOnce(returnValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, resolvedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockResolvedValue(resolvedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, resolvedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockResolvedValueOnce(resolvedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    if (value instanceof Error) {
      await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
        (electron, apiName, funcName, errMsg) => {
          const electronApi = electron[apiName as keyof typeof electron];
          (electronApi[funcName as keyof typeof electronApi] as Mock).mockRejectedValue(new Error(errMsg));
        },
        apiName,
        funcName,
        value.message,
        { internal: true },
      );
    } else {
      await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
        (electron, apiName, funcName, rejectedValue) => {
          const electronApi = electron[apiName as keyof typeof electron];
          (electronApi[funcName as keyof typeof electronApi] as Mock).mockRejectedValue(rejectedValue);
        },
        apiName,
        funcName,
        value,
        { internal: true },
      );
    }

    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, apiName, funcName, rejectedValue) => {
        const electronApi = electron[apiName as keyof typeof electron];
        (electronApi[funcName as keyof typeof electronApi] as Mock).mockRejectedValueOnce(rejectedValue);
      },
      apiName,
      funcName,
      value,
      { internal: true },
    );

    return mock;
  };

  mock.mockClear = async () => {
    // clears mock history
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockClear();
      },
      apiName,
      funcName,
      { internal: true },
    );
    outerMockClear();

    return mock;
  };

  mock.mockReset = async () => {
    // Store the current mock name to preserve it across reset
    const currentName = outerMock.getMockName();

    // resets inner implementation to an empty function and clears mock history
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockReset();
      },
      apiName,
      funcName,
      { internal: true },
    );
    outerMockReset();

    // Restore the mock name after reset (Vitest v4 clears it)
    outerMock.mockName(currentName);

    // vitest mockReset doesn't clear mock history so we need to explicitly clear both mocks
    await mock.mockClear();

    return mock;
  };

  mock.mockRestore = async () => {
    // restores inner mock implementation to the original function
    await restoreElectronFunctionality(apiName, funcName, browserToUse);

    // clear mocks
    outerMockClear();
    // Note: inner mock has been replaced with original function, so we don't call mockClear on it

    return mock;
  };

  mock.mockReturnThis = async () => {
    return await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).mockReturnThis();
      },
      apiName,
      funcName,
      { internal: true },
    );
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await browserToUse.electron.execute<unknown, [string, string, string, string, ExecuteOpts]>(
      async (electron, apiName, funcName, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)() as AbstractFn;
        const impl = new Function(`return ${implFnStr}`)() as AbstractFn;
        let result: unknown | Promise<unknown>;
        const fn = electron[apiName as keyof typeof electron][
          funcName as keyof ElectronType[ElectronInterface]
        ] as unknown as { withImplementation?: (impl: unknown, cb: () => unknown) => unknown };
        if (fn?.withImplementation) {
          fn.withImplementation(impl, () => {
            result = callback(electron);
          });
        } else {
          result = callback(electron);
        }

        return (result as Promise<unknown>)?.then ? await result : result;
      },
      apiName,
      funcName,
      implFn.toString(),
      callbackFn.toString(),
      { internal: true },
    );
  };

  // Ensure all mock methods are properly bound to the wrapper
  wrapperMock.mockImplementation = mock.mockImplementation.bind(mock);
  wrapperMock.mockImplementationOnce = mock.mockImplementationOnce.bind(mock);
  wrapperMock.getMockImplementation = mock.getMockImplementation.bind(mock);
  wrapperMock.mockReturnValue = mock.mockReturnValue.bind(mock);
  wrapperMock.mockReturnValueOnce = mock.mockReturnValueOnce.bind(mock);
  wrapperMock.mockResolvedValue = mock.mockResolvedValue.bind(mock);
  wrapperMock.mockResolvedValueOnce = mock.mockResolvedValueOnce.bind(mock);
  wrapperMock.mockRejectedValue = mock.mockRejectedValue.bind(mock);
  wrapperMock.mockRejectedValueOnce = mock.mockRejectedValueOnce.bind(mock);
  wrapperMock.mockClear = mock.mockClear.bind(mock);
  wrapperMock.mockReset = mock.mockReset.bind(mock);
  wrapperMock.mockRestore = async function (this: ElectronFunctionMock) {
    await mock.mockRestore();
    await restoreElectronFunctionality(apiName, funcName, browserToUse);
    return this;
  };
  wrapperMock.mockReturnThis = mock.mockReturnThis.bind(mock);
  wrapperMock.withImplementation = mock.withImplementation.bind(mock);
  wrapperMock.update = mock.update.bind(mock);

  // Set additional properties
  wrapperMock.__isElectronMock = true;

  log.debug(`[${apiName}.${funcName}] Auto-updating mock wrapper created successfully`);

  // Return the wrapper instead of the original mock
  return wrapperMock;
}

async function createPrototypeMock(
  className: string,
  methodName: string,
  browserToUse: WebdriverIO.Browser,
): Promise<ElectronFunctionMock> {
  const outerMock = vitestFn();
  const outerMockClear = outerMock.mockClear.bind(outerMock);
  const outerMockReset = outerMock.mockReset.bind(outerMock);
  const outerMockImplementation = outerMock.mockImplementation.bind(outerMock);
  const outerMockImplementationOnce = outerMock.mockImplementationOnce.bind(outerMock);
  const originalMock = outerMock.mock;
  outerMock.mockName(`electron.${className}.${methodName}`);

  const mock = outerMock as unknown as ElectronFunctionMock;
  mock.__isElectronMock = true;

  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    async (electron, className, methodName) => {
      const spy = await import('@wdio/native-spy');
      const cls = electron[className as keyof typeof electron] as unknown as {
        prototype: Record<string, () => unknown>;
      };
      const originalFn = cls.prototype[methodName];

      const globalApi = globalThis as unknown as Record<string, Record<string, Record<string, () => unknown>>>;
      if (!globalApi.__protoOriginals) globalApi.__protoOriginals = {};
      if (!globalApi.__protoOriginals[className]) globalApi.__protoOriginals[className] = {};
      globalApi.__protoOriginals[className][methodName] = originalFn;

      cls.prototype[methodName] = spy.fn(undefined, { original: originalFn });
    },
    className,
    methodName,
    { internal: true },
  );

  mock.update = async () => {
    const syncData = (await browserToUse.electron.execute<
      { calls: unknown[][]; results: { type: string; value: unknown }[] },
      [string, string, ExecuteOpts]
    >(
      (electron, className, methodName) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        const mockObj = cls?.prototype?.[methodName] as
          | { mock?: { calls?: unknown[][]; results?: { type: string; value: unknown }[] } }
          | undefined;
        const calls = mockObj?.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock.calls)) : [];
        const results = mockObj?.mock?.results ? JSON.parse(JSON.stringify(mockObj.mock.results)) : [];
        return { calls, results };
      },
      className,
      methodName,
      { internal: true },
    )) ?? { calls: [], results: [] };

    const existingCount = originalMock.calls.length;
    if (existingCount < syncData.calls.length) {
      for (let i = existingCount; i < syncData.calls.length; i++) {
        (originalMock.calls as unknown[][]).push(syncData.calls[i]);
        (originalMock.results as { type: string; value: unknown }[]).push(
          syncData.results[i] ?? { type: 'return', value: undefined },
        );
        (originalMock.invocationCallOrder as number[]).push(originalMock.invocationCallOrder.length);
      }
    }
    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, className, methodName, implStr) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        const impl = new Function(`return ${implStr}`)() as AbstractFn;
        (cls.prototype[methodName] as Mock).mockImplementation(impl);
      },
      className,
      methodName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementation(implFn);
    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await browserToUse.electron.execute<void, [string, string, string, ExecuteOpts]>(
      (electron, className, methodName, implStr) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        const impl = new Function(`return ${implStr}`)() as AbstractFn;
        (cls.prototype[methodName] as Mock).mockImplementationOnce(impl);
      },
      className,
      methodName,
      implFn.toString(),
      { internal: true },
    );
    outerMockImplementationOnce(implFn);
    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, returnValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockReturnValue(returnValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, returnValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockReturnValueOnce(returnValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, resolvedValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockResolvedValue(resolvedValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, resolvedValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockResolvedValueOnce(resolvedValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, rejectedValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockRejectedValue(rejectedValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await browserToUse.electron.execute<void, [string, string, unknown, ExecuteOpts]>(
      (electron, className, methodName, rejectedValue) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockRejectedValueOnce(rejectedValue);
      },
      className,
      methodName,
      value,
      { internal: true },
    );
    return mock;
  };

  mock.mockClear = async () => {
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, className, methodName) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockClear();
      },
      className,
      methodName,
      { internal: true },
    );
    outerMockClear();
    return mock;
  };

  mock.mockReset = async () => {
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, className, methodName) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockReset();
      },
      className,
      methodName,
      { internal: true },
    );
    outerMockReset();
    await mock.mockClear();
    return mock;
  };

  mock.mockRestore = async () => {
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, className, methodName) => {
        const cls = electron[className as keyof typeof electron] as unknown as {
          prototype: Record<string, () => unknown>;
        };
        const globalApi = globalThis as unknown as Record<string, Record<string, Record<string, () => unknown>>>;
        const originalFn = globalApi.__protoOriginals?.[className]?.[methodName];
        if (originalFn !== undefined) {
          cls.prototype[methodName] = originalFn;
        } else {
          delete cls.prototype[methodName];
        }
      },
      className,
      methodName,
      { internal: true },
    );
    outerMockClear();
    return mock;
  };

  mock.mockReturnThis = async () => {
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, className, methodName) => {
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        (cls.prototype[methodName] as Mock).mockReturnThis();
      },
      className,
      methodName,
      { internal: true },
    );
    return mock;
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await browserToUse.electron.execute<unknown, [string, string, string, string, ExecuteOpts]>(
      async (electron, className, methodName, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)() as AbstractFn;
        const impl = new Function(`return ${implFnStr}`)() as AbstractFn;
        const cls = electron[className as keyof typeof electron] as unknown as { prototype: Record<string, unknown> };
        const fn = cls.prototype[methodName] as
          | { withImplementation?: (impl: unknown, cb: () => unknown) => unknown }
          | undefined;
        let result: unknown | Promise<unknown>;
        if (fn?.withImplementation) {
          fn.withImplementation(impl, () => {
            result = callback(electron);
          });
        } else {
          result = callback(electron);
        }
        return (result as Promise<unknown>)?.then ? await result : result;
      },
      className,
      methodName,
      implFn.toString(),
      callbackFn.toString(),
      { internal: true },
    );
  };

  return mock;
}

/**
 * Creates a mock for an Electron class (e.g. Tray, BrowserWindow).
 * Returns a stub instance with all methods as ElectronFunctionMock objects.
 */
export async function createClassMock(
  className: string,
  browserContext?: WebdriverIO.Browser,
): Promise<ElectronClassMock> {
  log.debug(`[${className}] createClassMock called - starting class mock creation`);

  const browserToUse = browserContext || browser;

  // Get class method names from Electron, null if class doesn't exist
  const methodNames = await browserToUse.electron.execute<string[] | null, [string, ExecuteOpts]>(
    (electron, className) => {
      const ElectronClass = electron[className as keyof typeof electron] as
        | (new (
            ...args: unknown[]
          ) => unknown)
        | undefined;
      if (!ElectronClass || typeof ElectronClass !== 'function') return null;
      const methods = new Set<string>();
      let proto: object | null = ElectronClass.prototype;
      while (proto && proto !== Object.prototype) {
        const ctorName = (proto as { constructor?: { name?: string } }).constructor?.name ?? '';
        if (ctorName === 'EventEmitter') break;
        Object.getOwnPropertyNames(proto).forEach((name) => {
          if (name === 'constructor') return;
          const desc = Object.getOwnPropertyDescriptor(proto as object, name);
          if (desc && typeof desc.value === 'function') methods.add(name);
        });
        proto = Object.getPrototypeOf(proto) as object | null;
      }
      return [...methods];
    },
    className,
    { internal: true },
  );

  // Handle non-existent class gracefully (null becomes undefined via executeCdp's ?? coalescing)
  if (!methodNames) {
    log.debug(`[${className}] Class does not exist, returning empty stub`);
    const stubInstance: Record<string, unknown> = {};
    const constructorMock = vitestFn() as unknown as ElectronFunctionMock;
    constructorMock.mockName(`electron.${className}.__constructor`);
    constructorMock.__isElectronMock = true;
    constructorMock.update = async () => constructorMock;
    stubInstance.__constructor = constructorMock;
    (stubInstance as ElectronClassMock).getMockName = () => `electron.${className}`;
    (stubInstance as Record<string, unknown>).mockRestore = async () => {};
    return stubInstance as ElectronClassMock;
  }

  log.debug(`[${className}] Found ${methodNames.length} methods: ${methodNames.join(', ')}`);

  // Create stub instance with prototype method mocks
  const stubInstance: Record<string, ElectronFunctionMock | (() => Promise<void>)> = {};
  for (const methodName of methodNames) {
    log.debug(`[${className}] Creating prototype mock for method: ${methodName}`);
    const methodMock = await createPrototypeMock(className, methodName, browserToUse);
    stubInstance[methodName] = methodMock;
    mockStore.setMock(methodMock);
  }

  // Create constructor mock for tracking instantiation calls
  const constructorMock = vitestFn() as unknown as ElectronFunctionMock;
  constructorMock.mockName(`electron.${className}.__constructor`);
  constructorMock.__isElectronMock = true;
  const constructorOriginalMock = (constructorMock as unknown as Mock).mock;
  const constructorOuterMockClear = (constructorMock as unknown as Mock).mockClear.bind(constructorMock);
  const constructorOuterMockReset = (constructorMock as unknown as Mock).mockReset.bind(constructorMock);

  // Replace the class constructor in Electron via a Proxy on globalThis.electron
  // (direct assignment like Reflect.set fails because electron class properties are read-only)
  await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
    async (_electron, className) => {
      const spy = await import('@wdio/native-spy');
      const origElectron = (globalThis as Record<string, unknown>).electron as Record<string, unknown>;
      const OriginalClass = origElectron[className] as new (...args: unknown[]) => unknown;

      if (!globalThis.originalApi) {
        (globalThis as Record<string, unknown>).originalApi = {};
      }
      (globalThis.originalApi as Record<string, unknown>)[className] = OriginalClass;

      // spy.fn() with no implementation: when called via `new`, the new operator
      // provides `this` and returns it since the mock returns undefined (primitive)
      const MockClass = spy.fn() as unknown as typeof OriginalClass;
      MockClass.prototype = OriginalClass.prototype;
      Object.setPrototypeOf(MockClass, OriginalClass);

      if (!(globalThis as Record<string, unknown>).__electronClassMocks) {
        (globalThis as Record<string, unknown>).__electronClassMocks = {};
        (globalThis as Record<string, unknown>).electron = new Proxy(origElectron, {
          get(target, key) {
            const classMocks = (globalThis as Record<string, unknown>).__electronClassMocks as Record<string, unknown>;
            if (classMocks && typeof key === 'string' && key in classMocks) return classMocks[key];
            return Reflect.get(target, key);
          },
        });
      }
      ((globalThis as Record<string, unknown>).__electronClassMocks as Record<string, unknown>)[className] = MockClass;
    },
    className,
    { internal: true },
  );

  constructorMock.update = async () => {
    log.debug(`[${className}.__constructor] Starting mock update`);
    const calls =
      (await browserToUse.electron.execute<unknown[][], [string, ExecuteOpts]>(
        (electron, className) => {
          const mockObj = electron[className as keyof typeof electron] as unknown as {
            mock?: { calls?: unknown[][] };
          };
          return mockObj?.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock.calls)) : [];
        },
        className,
        { internal: true },
      )) ?? [];

    log.debug(
      `[${className}.__constructor] Retrieved ${calls.length} calls, outer mock has ${constructorOriginalMock.calls.length} calls`,
    );

    const existingCount = constructorOriginalMock.calls.length;
    if (existingCount < calls.length) {
      for (let i = existingCount; i < calls.length; i++) {
        (constructorMock as unknown as (...args: unknown[]) => unknown).apply(constructorMock, calls[i] as unknown[]);
      }
    }
    return constructorMock;
  };

  constructorMock.mockImplementationOnce = async (implFn: AbstractFn) => {
    await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
      (electron, className, implStr) => {
        const mockObj = electron[className as keyof typeof electron] as unknown as Mock;
        const impl = new Function(`return ${implStr}`)() as AbstractFn;
        mockObj.mockImplementationOnce(impl);
      },
      className,
      implFn.toString(),
      { internal: true },
    );
    return constructorMock;
  };

  constructorMock.mockClear = async () => {
    await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
      (electron, className) => {
        const mockObj = electron[className as keyof typeof electron] as unknown as Mock;
        mockObj.mockClear();
      },
      className,
      { internal: true },
    );
    constructorOuterMockClear();
    return constructorMock;
  };

  constructorMock.mockReset = async () => {
    await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
      (electron, className) => {
        const mockObj = electron[className as keyof typeof electron] as unknown as Mock;
        mockObj.mockReset();
      },
      className,
      { internal: true },
    );
    constructorOuterMockReset();
    await constructorMock.mockClear();
    return constructorMock;
  };

  constructorMock.mockRestore = async () => {
    log.debug(`[${className}] Restoring original class constructor`);
    await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
      (_electron, className) => {
        // Remove from class mocks map — proxy get trap falls back to original read-only class
        const classMocks = (globalThis as Record<string, unknown>).__electronClassMocks as
          | Record<string, unknown>
          | undefined;
        if (classMocks) {
          delete classMocks[className];
        }
      },
      className,
      { internal: true },
    );
    constructorOuterMockClear();
    return constructorMock;
  };

  stubInstance.__constructor = constructorMock;
  mockStore.setMock(constructorMock);

  // Class-level mockRestore: restores class constructor and all prototype methods
  stubInstance.mockRestore = async () => {
    log.debug(`[${className}] Restoring original class`);
    for (const methodName of methodNames) {
      await (stubInstance[methodName] as ElectronFunctionMock).mockRestore();
    }
    await constructorMock.mockRestore();
  };

  (stubInstance as ElectronClassMock).getMockName = () => `electron.${className}`;

  log.debug(`[${className}] Class mock created successfully`);

  return stubInstance as ElectronClassMock;
}
