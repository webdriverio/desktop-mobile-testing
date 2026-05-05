import { fn as vitestFn } from '@wdio/native-spy';
import { createIpcInterceptor } from '@wdio/native-spy/interceptor';
import type { AbstractFn, TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { execute as tauriExecute } from './commands/execute.js';
import mockStore from './mockStore.js';

const log = createLogger('tauri-service', 'mock');
const interceptor = createIpcInterceptor('tauri');

function isBrowserMode(browser: WebdriverIO.Browser): boolean {
  return !!(browser as unknown as Record<string, unknown>).__wdioBrowserMode__;
}

async function runInterceptorScript<T>(browser: WebdriverIO.Browser, script: string): Promise<T> {
  return browser.execute(`return (${script})()`) as Promise<T>;
}

export async function createMock(command: string, browserContext?: WebdriverIO.Browser): Promise<TauriMock> {
  log.debug(`[${command}] createMock called - starting mock creation`);

  const browserToUse = (browserContext || browser) as WebdriverIO.Browser;
  if (isBrowserMode(browserToUse)) {
    return createBrowserModeMock(command, browserToUse);
  }

  const outerMock = vitestFn();
  const outerMockImplementation = outerMock.mockImplementation;
  const outerMockImplementationOnce = outerMock.mockImplementationOnce;
  const outerMockClear = outerMock.mockClear;
  const outerMockReset = outerMock.mockReset;

  outerMock.mockName(`tauri.${command}`);

  const mock = outerMock as unknown as TauriMock;

  mock.__isTauriMock = true;

  const originalMock = outerMock.mock;

  log.debug(`[${command}] Creating auto-updating mock wrapper object`);

  const wrapperMock = ((...args: unknown[]) => {
    return (mock as (...args: unknown[]) => unknown)(...args);
  }) as TauriMock;

  Object.setPrototypeOf(wrapperMock, Object.getPrototypeOf(mock));
  Object.getOwnPropertyNames(mock).forEach((key) => {
    if (key !== 'mock' && key !== 'length' && key !== 'name') {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(mock, key);
        if (descriptor) {
          Object.defineProperty(wrapperMock, key, descriptor);
        }
      } catch (_error) {}
    }
  });

  Object.defineProperty(wrapperMock, 'mock', {
    configurable: false,
    enumerable: false,
    get() {
      return originalMock;
    },
  });

  log.debug(`[${command}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  log.debug(`[${command}] Setting up JavaScript mock`);
  await tauriExecute<void>(browserToUse, interceptor.buildRegistrationScript(command));
  log.debug(`[${command}] JavaScript mock setup complete`);

  mock.update = async () => {
    log.debug(`[${command}] Starting mock update`);
    const raw = await tauriExecute<unknown>(browserToUse, interceptor.buildCallDataReadScript(command));
    const syncData = interceptor.parseCallData(raw);

    const existingCount = originalMock.calls.length;
    log.debug(
      `[${command}] Retrieved ${syncData.calls.length} calls from inner mock, outer mock has ${existingCount} calls`,
    );

    if (existingCount < syncData.calls.length) {
      log.debug(`[${command}] Applying ${syncData.calls.length - existingCount} new calls to outer mock`);
      for (let i = existingCount; i < syncData.calls.length; i++) {
        (originalMock.calls as unknown[][]).push(syncData.calls[i]);
        (originalMock.results as { type: string; value: unknown }[]).push(
          syncData.results[i] ?? { type: 'return', value: undefined },
        );
        (originalMock.invocationCallOrder as number[]).push(
          syncData.invocationCallOrder[i] ?? originalMock.invocationCallOrder.length,
        );
      }
    } else {
      log.debug(`[${command}] No new calls to synchronize`);
    }

    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    const s = interceptor.serializeHandler(implFn);
    await tauriExecute<void>(browserToUse, interceptor.buildSetImplementationScript(command, s));
    outerMockImplementation(implFn);
    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    const s = interceptor.serializeHandler(implFn);
    await tauriExecute<void>(browserToUse, interceptor.buildSetImplementationScript(command, s, true));
    outerMockImplementationOnce(implFn);
    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockReturnValue', value));
    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockReturnValueOnce', value));
    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockResolvedValue', value));
    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockResolvedValueOnce', value));
    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockRejectedValue', value));
    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerSetterScript(command, 'mockRejectedValueOnce', value));
    return mock;
  };

  mock.mockClear = async () => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerInvocationScript(command, 'mockClear'));
    outerMockClear();
    return mock;
  };

  mock.mockReset = async () => {
    const currentName = outerMock.getMockName();

    await tauriExecute<void>(browserToUse, interceptor.buildInnerInvocationScript(command, 'mockReset'));

    // Temporarily restore the sync mockClear so outerMockReset's internal mockFn.mockClear()
    // call doesn't fire the async override, which would defer outerMockClear() and race
    // against auto-sync populating state.calls.
    const asyncMockClearFn = mock.mockClear;
    (mock as unknown as { mockClear: () => void }).mockClear = outerMockClear;
    wrapperMock.mockClear = outerMockClear as unknown as typeof wrapperMock.mockClear;
    outerMockClear();
    outerMockReset();
    mock.mockClear = asyncMockClearFn;
    wrapperMock.mockClear = asyncMockClearFn;
    outerMock.mockName(currentName);

    return mock;
  };

  mock.mockRestore = async () => {
    await tauriExecute<void>(browserToUse, interceptor.buildUnregistrationScript(command));
    outerMockClear();
    mockStore.deleteMock(`tauri.${command}`);
    return mock;
  };

  mock.mockReturnThis = async () => {
    await tauriExecute<void>(browserToUse, interceptor.buildInnerInvocationScript(command, 'mockReturnThis'));
    return mock;
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await tauriExecute<unknown>(
      browserToUse,
      interceptor.buildWithImplementationScript(
        command,
        implFn as (...a: unknown[]) => unknown,
        callbackFn as (...a: unknown[]) => unknown,
      ),
    );
  };

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
  wrapperMock.mockRestore = mock.mockRestore.bind(mock);
  wrapperMock.mockReturnThis = mock.mockReturnThis.bind(mock);
  wrapperMock.withImplementation = mock.withImplementation.bind(mock);
  wrapperMock.update = mock.update.bind(mock);

  wrapperMock.__isTauriMock = true;

  log.debug(`[${command}] Auto-updating mock wrapper created successfully`);

  return wrapperMock;
}

async function createBrowserModeMock(command: string, browser: WebdriverIO.Browser): Promise<TauriMock> {
  log.debug(`[${command}] createBrowserModeMock called`);

  const outerMock = vitestFn();
  const outerMockImplementation = outerMock.mockImplementation;
  const outerMockImplementationOnce = outerMock.mockImplementationOnce;
  const outerMockClear = outerMock.mockClear;
  const outerMockReset = outerMock.mockReset;

  outerMock.mockName(`tauri.${command}`);

  const mock = outerMock as unknown as TauriMock;
  mock.__isTauriMock = true;

  const originalMock = outerMock.mock;

  await runInterceptorScript<void>(browser, interceptor.buildRegistrationScript(command));

  mock.update = async () => {
    const raw = await runInterceptorScript<unknown>(browser, interceptor.buildCallDataReadScript(command));
    const syncData = interceptor.parseCallData(raw);

    const existingCount = originalMock.calls.length;
    if (existingCount < syncData.calls.length) {
      for (let i = existingCount; i < syncData.calls.length; i++) {
        (originalMock.calls as unknown[][]).push(syncData.calls[i]);
        (originalMock.results as { type: string; value: unknown }[]).push(
          syncData.results[i] ?? { type: 'return', value: undefined },
        );
        (originalMock.invocationCallOrder as number[]).push(
          syncData.invocationCallOrder[i] ?? originalMock.invocationCallOrder.length,
        );
      }
    }
    return mock;
  };

  mock.mockImplementation = async (implFn: AbstractFn) => {
    const s = interceptor.serializeHandler(implFn);
    await runInterceptorScript<void>(browser, interceptor.buildSetImplementationScript(command, s));
    outerMockImplementation(implFn);
    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    const s = interceptor.serializeHandler(implFn);
    await runInterceptorScript<void>(browser, interceptor.buildSetImplementationScript(command, s, true));
    outerMockImplementationOnce(implFn);
    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await runInterceptorScript<void>(browser, interceptor.buildInnerSetterScript(command, 'mockReturnValue', value));
    return mock;
  };

  mock.mockReturnValueOnce = async (value: unknown) => {
    await runInterceptorScript<void>(
      browser,
      interceptor.buildInnerSetterScript(command, 'mockReturnValueOnce', value),
    );
    return mock;
  };

  mock.mockResolvedValue = async (value: unknown) => {
    await runInterceptorScript<void>(browser, interceptor.buildInnerSetterScript(command, 'mockResolvedValue', value));
    return mock;
  };

  mock.mockResolvedValueOnce = async (value: unknown) => {
    await runInterceptorScript<void>(
      browser,
      interceptor.buildInnerSetterScript(command, 'mockResolvedValueOnce', value),
    );
    return mock;
  };

  mock.mockRejectedValue = async (value: unknown) => {
    await runInterceptorScript<void>(browser, interceptor.buildInnerSetterScript(command, 'mockRejectedValue', value));
    return mock;
  };

  mock.mockRejectedValueOnce = async (value: unknown) => {
    await runInterceptorScript<void>(
      browser,
      interceptor.buildInnerSetterScript(command, 'mockRejectedValueOnce', value),
    );
    return mock;
  };

  mock.mockClear = async () => {
    await runInterceptorScript<void>(browser, interceptor.buildInnerInvocationScript(command, 'mockClear'));
    outerMockClear();
    return mock;
  };

  mock.mockReset = async () => {
    const currentName = outerMock.getMockName();
    await runInterceptorScript<void>(browser, interceptor.buildInnerInvocationScript(command, 'mockReset'));
    const asyncMockClearFn = mock.mockClear;
    (mock as unknown as { mockClear: () => void }).mockClear = outerMockClear;
    outerMockClear();
    outerMockReset();
    mock.mockClear = asyncMockClearFn;
    outerMock.mockName(currentName);
    return mock;
  };

  mock.mockRestore = async () => {
    await runInterceptorScript<void>(browser, interceptor.buildUnregistrationScript(command));
    outerMockClear();
    mockStore.deleteMock(`tauri.${command}`);
    return mock;
  };

  mock.mockReturnThis = async () => {
    await runInterceptorScript<void>(browser, interceptor.buildInnerInvocationScript(command, 'mockReturnThis'));
    return mock;
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    const script = interceptor.buildWithImplementationScript(
      command,
      implFn as (...a: unknown[]) => unknown,
      callbackFn as (...a: unknown[]) => unknown,
    );
    return browser.executeAsync((s: string, done: (v: unknown) => void) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function('return (' + s + ')')() as () => Promise<unknown>;
      Promise.resolve(fn()).then(done, (err: unknown) => {
        done({ __wdioAsyncErr__: err instanceof Error ? err.message : String(err) });
      });
    }, script);
  };

  log.debug(`[${command}] Browser-mode mock created successfully`);
  return mock;
}
