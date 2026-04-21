import { fn as vitestFn } from '@wdio/native-spy';
import type {
  ElectronApiFn,
  ElectronFunctionMock,
  ElectronInterface,
  ElectronType,
  ExecuteOpts,
} from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { buildMockMethods, restoreElectronFunctionality } from './mockFactory.js';

const log = createLogger('electron-service', 'mock');

export { createClassMock } from './classMock.js';

export async function createMock(
  apiName: string,
  funcName: string,
  browserContext?: WebdriverIO.Browser,
): Promise<ElectronFunctionMock> {
  log.debug(`[${apiName}.${funcName}] createMock called - starting mock creation`);
  const outerMock = vitestFn();

  outerMock.mockName(`electron.${apiName}.${funcName}`);

  const mock = outerMock as unknown as ElectronFunctionMock;
  mock.__isElectronMock = true;

  const originalMock = outerMock.mock;

  log.debug(`[${apiName}.${funcName}] Creating auto-updating mock wrapper object`);

  const wrapperMock = ((...args: unknown[]) => {
    return (mock as (...args: unknown[]) => unknown)(...args);
  }) as ElectronFunctionMock;

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

  Object.defineProperty(wrapperMock, 'mock', {
    configurable: false,
    enumerable: false,
    get() {
      return originalMock;
    },
  });

  Object.defineProperty(wrapperMock, 'lastCall', {
    configurable: true,
    enumerable: true,
    get() {
      return originalMock.calls[originalMock.calls.length - 1];
    },
  });

  const browserToUse = browserContext || browser;

  log.debug(`[${apiName}.${funcName}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron] as unknown as Record<string, () => unknown>;
      const originalFn = electronApi[funcName];

      if (originalFn) {
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

  await browserToUse.electron.execute<void, [string, string, ExecuteOpts]>(
    async (electron, apiName, funcName) => {
      const electronApi = electron[apiName as keyof typeof electron];
      const spy = await import('@wdio/native-spy');

      const originalApi = globalThis.originalApi as unknown as Record<string, Record<string, () => unknown>>;
      const originalFn = originalApi?.[apiName]?.[funcName];

      const mockFn = spy.fn(
        function (this: unknown) {
          return undefined;
        },
        { original: originalFn },
      );

      electronApi[funcName as keyof typeof electronApi] = mockFn as ElectronApiFn;
    },
    apiName,
    funcName,
    { internal: true },
  );

  mock.update = async () => {
    log.debug(`[${apiName}.${funcName}] Starting mock update`);
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

  await buildMockMethods(mock, {
    accessor: { kind: 'api', apiName, funcName },
    outerMock,
    outerMockClear: outerMock.mockClear.bind(outerMock),
    outerMockReset: outerMock.mockReset.bind(outerMock),
    outerMockImplementation: outerMock.mockImplementation.bind(outerMock),
    outerMockImplementationOnce: outerMock.mockImplementationOnce.bind(outerMock),
    browserToUse,
  });

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

  wrapperMock.__isElectronMock = true;

  log.debug(`[${apiName}.${funcName}] Auto-updating mock wrapper created successfully`);

  return wrapperMock;
}
