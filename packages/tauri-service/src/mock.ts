import { fn as vitestFn } from '@wdio/native-spy';
import type { AbstractFn, TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { execute as tauriExecute } from './commands/execute.js';
import mockStore from './mockStore.js';

const log = createLogger('tauri-service', 'mock');

interface InnerMock {
  mock?: { calls?: unknown[]; results?: unknown[]; invocationCallOrder?: number[] };
  mockClear?: () => void;
  mockReset?: () => void;
  mockReturnValue?: (val: unknown) => void;
  mockReturnValueOnce?: (val: unknown) => void;
  mockResolvedValue?: (val: unknown) => void;
  mockResolvedValueOnce?: (val: unknown) => void;
  mockRejectedValue?: (val: unknown) => void;
  mockRejectedValueOnce?: (val: unknown) => void;
  mockImplementation?: (fn: unknown) => void;
  mockImplementationOnce?: (fn: unknown) => void;
  mockReturnThis?: () => void;
  withImplementation?: (impl: unknown, cb: unknown) => void;
}

async function restoreTauriCommand(command: string, browserContext?: WebdriverIO.Browser) {
  const browserToUse = browserContext || browser;

  await tauriExecute<void, [string]>(
    browserToUse,
    (_tauri, cmd) => {
      // @ts-expect-error - window is available in browser context
      if (window.__wdio_mocks__?.[cmd]) {
        // @ts-expect-error - window is available in browser context
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

  const browserToUse: WebdriverIO.Browser = (browserContext || browser) as WebdriverIO.Browser;

  log.debug(`[${command}] Using browser context:`, typeof browserToUse, browserToUse?.constructor?.name);

  log.debug(`[${command}] Setting up JavaScript mock`);
  await tauriExecute<void, [string]>(
    browserToUse,
    (_tauri, cmd) => {
      // @ts-expect-error - window is available in browser context
      const spy = window.__wdio_spy__;
      if (!spy?.fn) {
        throw new Error(
          '@wdio/native-spy not available. Make sure @wdio/tauri-plugin is imported and initialized in your app.',
        );
      }

      const mockFn = spy.fn();
      mockFn.mockName(`tauri.${cmd}`);

      // @ts-expect-error - window is available in browser context
      if (!window.__wdio_mocks__) {
        // @ts-expect-error - window is available in browser context
        window.__wdio_mocks__ = {};
      }
      // @ts-expect-error - window is available in browser context
      window.__wdio_mocks__[cmd] = mockFn;
    },
    command,
  );
  log.debug(`[${command}] JavaScript mock setup complete`);

  await tauriExecute<void, [string]>(
    browserToUse,
    (_tauri, cmd) => {
      // @ts-expect-error - window is available in browser context
      const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
      mockObj?.mockClear?.();
    },
    command,
  );
  log.debug(`[${command}] Inner mock cleared to ensure clean initial state`);

  mock.update = async () => {
    log.debug(`[${command}] Starting mock update`);
    const syncData = (await tauriExecute<
      { calls: unknown[][]; results: { type: string; value: unknown }[]; invocationCallOrder: number[] },
      [string]
    >(
      browserToUse,
      (_tauri, cmd: string) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        if (!mockObj?.mock) {
          return { calls: [], results: [], invocationCallOrder: [] };
        }
        const m = mockObj.mock;
        return {
          calls: JSON.parse(JSON.stringify(m.calls || [])),
          results: JSON.parse(JSON.stringify(m.results || [])),
          invocationCallOrder: JSON.parse(JSON.stringify(m.invocationCallOrder || [])),
        };
      },
      command,
    )) || { calls: [], results: [], invocationCallOrder: [] };

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
    const implStr = implFn.toString();
    await tauriExecute<void, [string]>(
      browserToUse,
      `((_tauri, cmd) => { const mockObj = window.__wdio_mocks__?.[cmd]; if (mockObj) { mockObj.mockImplementation?.(${implStr}); } })`,
      command,
    );

    outerMockImplementation(implFn);

    return mock;
  };

  mock.mockImplementationOnce = async (implFn: AbstractFn) => {
    const implStr = implFn.toString();
    await tauriExecute<void, [string]>(
      browserToUse,
      `((_tauri, cmd) => { const mockObj = window.__wdio_mocks__?.[cmd]; if (mockObj) { mockObj.mockImplementationOnce?.(${implStr}); } })`,
      command,
    );

    outerMockImplementationOnce(implFn);

    return mock;
  };

  mock.mockReturnValue = async (value: unknown) => {
    await tauriExecute<void, [string, unknown]>(
      browserToUse,
      (_tauri, cmd, returnValue) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockReturnValue?.(returnValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockReturnValueOnce?.(returnValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockResolvedValue?.(resolvedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockResolvedValueOnce?.(resolvedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockRejectedValue?.(rejectedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockRejectedValueOnce?.(rejectedValue);
      },
      command,
      value,
    );

    return mock;
  };

  mock.mockClear = async () => {
    await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockClear?.();
      },
      command,
    );

    outerMockClear();

    return mock;
  };

  mock.mockReset = async () => {
    const currentName = outerMock.getMockName();

    await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockReset?.();
      },
      command,
    );

    // Call outerMockClear synchronously before outerMockReset, because outerMockReset internally
    // calls mock.mockClear (now async) without awaiting — this ensures state is cleared immediately.
    outerMockClear();
    outerMockReset();
    outerMock.mockName(currentName);

    return mock;
  };

  mock.mockRestore = async () => {
    await restoreTauriCommand(command, browserToUse);

    outerMockClear();
    mockStore.deleteMock(`tauri.${command}`);

    return mock;
  };

  mock.mockReturnThis = async () => {
    await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.mockReturnThis?.();
      },
      command,
    );
    return mock;
  };

  mock.withImplementation = async (implFn, callbackFn) => {
    return await tauriExecute<unknown, [string, string, string]>(
      browserToUse,
      async (tauri, cmd, implFnStr, callbackFnStr) => {
        const callback = new Function(`return ${callbackFnStr}`)();
        const impl = new Function(`return ${implFnStr}`)();
        let result: unknown | Promise<unknown>;

        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd] as InnerMock | undefined;
        mockObj?.withImplementation?.(impl, () => {
          result = callback(tauri);
        });

        return (result as Promise<unknown>)?.then ? await result : result;
      },
      command,
      implFn.toString(),
      callbackFn.toString(),
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
