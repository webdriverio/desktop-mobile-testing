import { fn as vitestFn } from '@wdio/native-spy';
import type { AbstractFn, TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { execute as tauriExecute } from './commands/execute.js';

const log = createLogger('tauri-service', 'mock');

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
      if (!spy || !spy.fn) {
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

  mock.update = async () => {
    log.debug(`[${command}] Starting mock update`);
    const calls =
      (await tauriExecute<unknown[][], [string]>(
        browserToUse,
        (_tauri, cmd: string) => {
          // @ts-expect-error - window is available in browser context
          const mockObj = window.__wdio_mocks__?.[cmd];
          if (!mockObj?.mock) return [];
          return JSON.parse(JSON.stringify((mockObj.mock as { calls?: unknown[] }).calls || []));
        },
        command,
      )) || [];

    const outerCalls = originalMock.calls;
    log.debug(
      `[${command}] Retrieved ${calls.length} calls from inner mock, outer mock has ${outerCalls.length} calls`,
    );

    // Re-apply calls from the browser inner mock to the outer one
    if (outerCalls.length < calls.length) {
      log.debug(`[${command}] Applying ${calls.length - outerCalls.length} new calls to outer mock`);
      calls.forEach((call: unknown[], index: number) => {
        if (!outerCalls[index]) {
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
    await tauriExecute<void, [string, string]>(
      browserToUse,
      (_tauri, cmd, mockImplementationStr) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          const mockImpl = new Function(`return ${mockImplementationStr}`)();
          (mockObj as { mockImplementation?: (fn: unknown) => void }).mockImplementation?.(mockImpl);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          const mockImpl = new Function(`return ${mockImplementationStr}`)();
          (mockObj as { mockImplementationOnce?: (fn: unknown) => void }).mockImplementationOnce?.(mockImpl);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockReturnValue?: (val: unknown) => void }).mockReturnValue?.(returnValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockReturnValueOnce?: (val: unknown) => void }).mockReturnValueOnce?.(returnValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockResolvedValue?: (val: unknown) => void }).mockResolvedValue?.(resolvedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockResolvedValueOnce?: (val: unknown) => void }).mockResolvedValueOnce?.(resolvedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockRejectedValue?: (val: unknown) => void }).mockRejectedValue?.(rejectedValue);
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
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockRejectedValueOnce?: (val: unknown) => void }).mockRejectedValueOnce?.(rejectedValue);
        }
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
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockClear?: () => void }).mockClear?.();
        }
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
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockReset?: () => void }).mockReset?.();
        }
      },
      command,
    );

    outerMockReset();
    outerMock.mockName(currentName);

    await mock.mockClear();

    return mock;
  };

  mock.mockRestore = async () => {
    await restoreTauriCommand(command, browserToUse);

    outerMockClear();

    return mock;
  };

  mock.mockReturnThis = async () => {
    return await tauriExecute<void, [string]>(
      browserToUse,
      (_tauri, cmd) => {
        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { mockReturnThis?: () => void }).mockReturnThis?.();
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

        // @ts-expect-error - window is available in browser context
        const mockObj = window.__wdio_mocks__?.[cmd];
        if (mockObj) {
          (mockObj as { withImplementation?: (impl: unknown, cb: unknown) => void }).withImplementation?.(impl, () => {
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

  wrapperMock.__isTauriMock = true;

  log.debug(`[${command}] Auto-updating mock wrapper created successfully`);

  return wrapperMock;
}
