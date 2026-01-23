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

const log = createLogger('electron-service', 'mock');

async function restoreElectronFunctionality(apiName: string, funcName: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];

      // Always restore to the original function from globalThis.originalApi
      const originalApi = globalThis.originalApi as Record<ElectronInterface, ElectronType[ElectronInterface]>;
      const originalApiMethod = originalApi[apiName as keyof typeof originalApi][
        funcName as keyof ElectronType[ElectronInterface]
      ] as ElectronApiFn;
      Reflect.set(electronApi as unknown as object, funcName, originalApiMethod as unknown as ElectronApiFn);
    },
    apiName,
    funcName,
    { internal: true },
  );
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

  // Use provided browser context or fallback to global browser
  const browserToUse = browserContext || browser;

  log.debug(`[${apiName}.${funcName}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  // initialise inner (Electron) mock
  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    async (electron, apiName, funcName) => {
      console.log(`[MOCK-INIT] Starting mock creation for ${apiName}.${funcName}`);
      const electronApi = electron[apiName as keyof typeof electron];
      console.log(`[MOCK-INIT] Got electronApi:`, typeof electronApi);

      console.log(`[MOCK-INIT] About to import @wdio/native-spy...`);
      const spy = await import('@wdio/native-spy');
      console.log(`[MOCK-INIT] Imported spy:`, typeof spy, Object.keys(spy));

      const mockFn = spy.fn(function (this: unknown) {
        // Default implementation returns undefined (does not call the original function)
        // This prevents real dialogs/actions from occurring when mocking
        // Users can call mockImplementation() to provide custom behavior
        console.log(`[MOCK-CALL] ${apiName}.${funcName} was called`);
        return undefined;
      });
      console.log(`[MOCK-INIT] Created mockFn:`, typeof mockFn);
      console.log(`[MOCK-INIT] mockFn._isMockFunction:`, (mockFn as any)._isMockFunction);
      console.log(`[MOCK-INIT] mockFn.mock:`, mockFn.mock);

      // replace target API with mock
      electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
      console.log(`[MOCK-INIT] Replaced ${apiName}.${funcName} with mock`);
    },
    apiName,
    funcName,
    { internal: true },
  );

  mock.update = async () => {
    log.debug(`[${apiName}.${funcName}] Starting mock update`);
    // synchronises inner and outer mocks
    const calls = await browserToUse.electron.execute<unknown[][], [string, string, ExecuteOpts]>(
      (electron, apiName, funcName) => {
        const mockObj = electron[apiName as keyof typeof electron][
          funcName as keyof ElectronType[ElectronInterface]
        ] as ElectronFunctionMock;
        return mockObj.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock?.calls)) : [];
      },
      apiName,
      funcName,
      { internal: true },
    );

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
        (
          electron[apiName as keyof typeof electron][funcName as keyof ElectronType[ElectronInterface]] as Mock
        ).withImplementation(impl, () => {
          result = callback(electron);
        });

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
  wrapperMock.__isElectronMock = true;

  log.debug(`[${apiName}.${funcName}] Auto-updating mock wrapper created successfully`);

  // Return the wrapper instead of the original mock
  return wrapperMock;
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

  // Get class method names from Electron
  const methodNames = await browserToUse.electron.execute<string[], [string, ExecuteOpts]>(
    (electron, className) => {
      const ElectronClass = electron[className as keyof typeof electron] as
        | (new (
            ...args: unknown[]
          ) => unknown)
        | undefined;
      if (!ElectronClass || typeof ElectronClass !== 'function') {
        throw new Error(`electron.${className} is not a class`);
      }
      return Object.getOwnPropertyNames(ElectronClass.prototype).filter(
        (name) => name !== 'constructor' && typeof ElectronClass.prototype[name] === 'function',
      );
    },
    className,
    { internal: true },
  );

  log.debug(`[${className}] Found ${methodNames.length} methods: ${methodNames.join(', ')}`);

  // Create stub instance with all methods as ElectronFunctionMock
  const stubInstance: Record<string, ElectronFunctionMock | (() => Promise<void>)> = {};
  for (const methodName of methodNames) {
    log.debug(`[${className}] Creating mock for method: ${methodName}`);
    stubInstance[methodName] = await createMock(className, methodName, browserToUse);
  }

  // Create constructor mock for tracking instantiation calls
  const constructorMock = vitestFn() as unknown as ElectronFunctionMock;
  constructorMock.mockName(`electron.${className}.__constructor`);
  (constructorMock as ElectronFunctionMock).__isElectronMock = true;

  // Store original mock state for updates
  const constructorOriginalMock = (constructorMock as unknown as Mock).mock;

  // Replace the class constructor in Electron
  await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
    async (electron, className) => {
      const spy = await import('@wdio/native-spy');
      const OriginalClass = electron[className as keyof typeof electron] as new (...args: unknown[]) => unknown;

      // Store original for restoration
      if (!globalThis.originalApi) {
        (globalThis as Record<string, unknown>).originalApi = {};
      }
      (globalThis.originalApi as Record<string, unknown>)[className] = OriginalClass;

      // Create mock constructor that tracks calls and returns an instance with mocked prototype
      const MockClass = spy.fn(function (this: unknown, ..._args: unknown[]) {
        // Call original constructor behavior by setting up prototype chain
        Object.setPrototypeOf(this, OriginalClass.prototype);
        return this;
      }) as unknown as typeof OriginalClass;

      // Copy prototype so instanceof checks and method access work
      MockClass.prototype = OriginalClass.prototype;
      Object.setPrototypeOf(MockClass, OriginalClass);

      Reflect.set(electron, className, MockClass);
    },
    className,
    { internal: true },
  );

  // Add update method to constructor mock to sync call tracking
  (constructorMock as ElectronFunctionMock).update = async () => {
    log.debug(`[${className}.__constructor] Starting mock update`);
    const calls = await browserToUse.electron.execute<unknown[][], [string, ExecuteOpts]>(
      (electron, className) => {
        const mockObj = electron[className as keyof typeof electron] as unknown as ElectronFunctionMock;
        return mockObj.mock?.calls ? JSON.parse(JSON.stringify(mockObj.mock?.calls)) : [];
      },
      className,
      { internal: true },
    );

    // Re-apply calls from electron main process mock to outer one
    if (constructorOriginalMock.calls.length < calls.length) {
      calls.forEach((call: unknown[], index: number) => {
        if (!constructorOriginalMock.calls[index]) {
          constructorMock.apply(constructorMock, call);
        }
      });
    }

    return constructorMock;
  };

  stubInstance.__constructor = constructorMock;

  // Add mockRestore to restore the original class
  stubInstance.mockRestore = async () => {
    log.debug(`[${className}] Restoring original class`);
    await browserToUse.electron.execute<void, [string, ExecuteOpts]>(
      (electron, className) => {
        const originalApi = globalThis.originalApi as Record<string, unknown>;
        if (originalApi?.[className]) {
          Reflect.set(electron, className, originalApi[className]);
        }
      },
      className,
      { internal: true },
    );
  };

  // Add getMockName method for consistency with ElectronMock
  (stubInstance as ElectronClassMock).getMockName = () => `electron.${className}`;

  log.debug(`[${className}] Class mock created successfully`);

  return stubInstance as ElectronClassMock;
}
