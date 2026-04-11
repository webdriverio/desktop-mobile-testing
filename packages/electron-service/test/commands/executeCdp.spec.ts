import type { ElectronMock } from '@wdio/native-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronCdpBridge } from '../../src/bridge.js';
import { clearParsedFunctionCache, execute } from '../../src/commands/executeCdp.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => {
  const mockStore = {
    getMocks: vi.fn().mockReturnValue([]),
  };
  return {
    default: mockStore,
  };
});

describe('execute Command', () => {
  beforeEach(async () => {
    globalThis.browser = {} as WebdriverIO.Browser;
    globalThis.mrBrowser = {
      isMultiremote: true,
      instances: ['browserA', 'browserB'],
      getInstance: vi.fn().mockReturnValue({
        electron: {
          execute: vi.fn(),
        },
      } as unknown as WebdriverIO.Browser),
    } as unknown as WebdriverIO.MultiRemoteBrowser;
    vi.clearAllMocks();
    clearParsedFunctionCache();
  });
  const client = {
    contextId: 9999,
    connect: vi.fn(),
    on: vi.fn(),
    send: vi.fn().mockResolvedValue({ result: { result: { value: 6 } } }),
  } as unknown as ElectronCdpBridge;

  it('should throw an error when called with a script argument of the wrong type', async () => {
    await expect(() => execute(globalThis.browser, client, {} as string)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when called without a script argument', async () => {
    // @ts-expect-error no script argument
    await expect(() => execute(globalThis.browser, {})).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should return undefined when called without client', async () => {
    const result = await execute(globalThis.browser, undefined, '() => {}');
    expect(result).toBeUndefined();
  });

  it('should throw an error when the browser is not initialised', async () => {
    await expect(() =>
      execute(undefined as unknown as typeof globalThis.browser, client, '() => 1 + 2 + 3'),
    ).rejects.toThrowError(new Error('WDIO browser is not yet initialised'));
  });

  it('should execute a function', async () => {
    await execute(globalThis.browser, client, (_electron, a, b, c) => a + b + c, 1, 2, 3);
    expect(client.send).toHaveBeenCalledWith('Runtime.callFunctionOn', {
      arguments: [{ value: 1 }, { value: 2 }, { value: 3 }],
      awaitPromise: true,
      executionContextId: 9999,
      functionDeclaration: '(a, b, c) => a + b + c',
      returnByValue: true,
    });
  });

  it('should execute a stringified function', async () => {
    await execute(globalThis.browser, client, '(electron) => 1 + 2 + 3');
    expect(client.send).toHaveBeenCalledWith('Runtime.callFunctionOn', {
      arguments: [],
      awaitPromise: true,
      executionContextId: 9999,
      functionDeclaration: '() => 1 + 2 + 3',
      returnByValue: true,
    });
  });

  it('should execute a function when multi remote browser', async () => {
    const mockElectron = globalThis.mrBrowser.getInstance('browserA');
    await execute(globalThis.mrBrowser, client, (_electron, a, b, c) => a + b + c, 1, 2, 3);

    expect(mockElectron.electron.execute).toHaveBeenCalledTimes(2); // Because mrBrowser has 2 browser instance
  });

  it('should execute a function declaration', async () => {
    await execute(
      globalThis.browser,
      client,
      function test(_electron, a: number, b: number, c: number) {
        return a + b + c;
      },
      1,
      2,
      3,
    );

    expect(client.send).toHaveBeenCalledWith('Runtime.callFunctionOn', {
      arguments: [{ value: 1 }, { value: 2 }, { value: 3 }],
      awaitPromise: true,
      executionContextId: 9999,
      functionDeclaration: expect.stringMatching(/function test\(a, b, c\)\s*\{\s*return a \+ b \+ c;\s*\}/),
      returnByValue: true,
    });
  });

  it('should wrap statement-style string scripts in async IIFE', async () => {
    // Statements like 'const a = 1' are now wrapped and executed properly (no longer throw)
    await execute(globalThis.browser, client, 'const a = 1');
    expect(client.send).toHaveBeenCalledWith(
      'Runtime.callFunctionOn',
      expect.objectContaining({
        functionDeclaration: expect.stringContaining('async () => { const a = 1 }'),
      }),
    );
  });

  it('should call `mock.update()` when mockStore has some mocks', async () => {
    const updateMock = vi.fn();
    vi.mocked(mockStore.getMocks).mockReturnValue([['dummy', { update: updateMock } as unknown as ElectronMock]]);
    await execute(globalThis.browser, client, (_electron, a, b, c) => a + b + c, 1, 2, 3);

    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});

describe('parsed function cache', () => {
  const client = {
    contextId: 9999,
    connect: vi.fn(),
    on: vi.fn(),
    send: vi.fn().mockResolvedValue({ result: { result: { value: 6 } } }),
  } as unknown as ElectronCdpBridge;

  beforeEach(() => {
    globalThis.browser = {} as WebdriverIO.Browser;
    clearParsedFunctionCache();
    vi.clearAllMocks();
  });

  it('should cache parsed function strings', async () => {
    const script = (_electron: unknown, a: number, b: number) => a + b;

    await execute(globalThis.browser, client, script, 1, 2);
    await execute(globalThis.browser, client, script, 3, 4);

    const calls = vi.mocked(client.send).mock.calls;
    const firstDecl = calls[0][1] as { functionDeclaration: string };
    const secondDecl = calls[1][1] as { functionDeclaration: string };

    expect(firstDecl.functionDeclaration).toBe('(a, b) => a + b');
    expect(secondDecl.functionDeclaration).toBe('(a, b) => a + b');
  });

  it('should clear cache when clearParsedFunctionCache is called', async () => {
    const script = (_electron: unknown, a: number) => a * 2;

    await execute(globalThis.browser, client, script, 5);
    clearParsedFunctionCache();
    await execute(globalThis.browser, client, script, 10);

    expect(client.send).toHaveBeenCalledTimes(2);
  });
});
