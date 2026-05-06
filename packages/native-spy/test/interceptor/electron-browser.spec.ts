import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { ElectronAdapter } from '../../src/interceptor/electron.js';
import { createIpcInterceptor } from '../../src/interceptor/index.js';

function runInBrowserContext(script: string, windowProps: Record<string, unknown> = {}) {
  const window: Record<string, unknown> = { ...windowProps };
  const ctx = vm.createContext({ window, Promise });
  vm.runInContext(script, ctx);
  return window;
}

describe('ElectronAdapter.buildBrowserIpcInjectionScript', () => {
  const adapter = new ElectronAdapter();

  it('should set window.__wdio_spy__ with a fn factory', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(typeof (window.__wdio_spy__ as Record<string, unknown>)?.fn).toBe('function');
  });

  it('should create window.__wdio_mocks__ if absent', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(window.__wdio_mocks__).toEqual({});
  });

  it('should not overwrite existing window.__wdio_mocks__', () => {
    const existing = { 'my-channel': () => {} };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { __wdio_mocks__: existing });
    expect(window.__wdio_mocks__).toBe(existing);
  });

  it('should create window.electron.ipcRenderer if absent', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const ipcRenderer = (window.electron as Record<string, unknown>)?.ipcRenderer as Record<string, unknown>;
    expect(typeof ipcRenderer?.invoke).toBe('function');
    expect(typeof ipcRenderer?.send).toBe('function');
    expect(typeof ipcRenderer?.sendSync).toBe('function');
  });

  it('should preserve existing window.electron object and only patch ipcRenderer', () => {
    const existingElectron = { other: 'value' };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { electron: existingElectron });
    const electron = window.electron as Record<string, unknown>;
    expect(electron.other).toBe('value');
    const ipcRenderer = electron.ipcRenderer as Record<string, unknown>;
    expect(typeof ipcRenderer?.invoke).toBe('function');
  });

  it('should reject with error for unmocked invoke calls', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const ipcRenderer = (window.electron as Record<string, unknown>).ipcRenderer as Record<string, unknown>;
    const invoke = ipcRenderer.invoke as (channel: string, ...args: unknown[]) => Promise<unknown>;
    await expect(invoke('unknown-channel')).rejects.toThrow(
      'unmocked Electron IPC channel in browser mode: unknown-channel',
    );
  });

  it('should route invoke to window.__wdio_mocks__[channel] when registered', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    (window.__wdio_mocks__ as Record<string, unknown>)['get-data'] = (x: unknown) => `result:${x}`;
    const ipcRenderer = (window.electron as Record<string, unknown>).ipcRenderer as Record<string, unknown>;
    const invoke = ipcRenderer.invoke as (channel: string, ...args: unknown[]) => Promise<unknown>;
    await expect(invoke('get-data', 'hello')).resolves.toBe('result:hello');
  });

  it('should spread args to the registered mock', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    let capturedArgs: unknown[];
    (window.__wdio_mocks__ as Record<string, unknown>)['multi-arg'] = (...args: unknown[]) => {
      capturedArgs = args;
      return 'ok';
    };
    const ipcRenderer = (window.electron as Record<string, unknown>).ipcRenderer as Record<string, unknown>;
    const invoke = ipcRenderer.invoke as (channel: string, ...args: unknown[]) => Promise<unknown>;
    await invoke('multi-arg', 'a', 'b', 'c');
    expect(capturedArgs!).toEqual(['a', 'b', 'c']);
  });

  it('should throw synchronously for send on unmocked channels', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const ipcRenderer = (window.electron as Record<string, unknown>).ipcRenderer as Record<string, unknown>;
    const send = ipcRenderer.send as (channel: string) => void;
    expect(() => send('some-channel')).toThrow('unmocked Electron IPC channel in browser mode: some-channel');
  });

  it('should throw synchronously for sendSync on unmocked channels', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const ipcRenderer = (window.electron as Record<string, unknown>).ipcRenderer as Record<string, unknown>;
    const sendSync = ipcRenderer.sendSync as (channel: string) => void;
    expect(() => sendSync('sync-channel')).toThrow('unmocked Electron IPC channel in browser mode: sync-channel');
  });

  describe('fn()', () => {
    it('should create a mock with empty call history', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      const mock = mockFn.mock as Record<string, unknown>;
      expect(mock.calls).toEqual([]);
      expect(mock.results).toEqual([]);
      expect(mock.invocationCallOrder).toEqual([]);
    });

    it('should record calls and results', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => (...a: unknown[]) => unknown)();
      mockFn('arg1', 'arg2');
      const mock = (mockFn as unknown as Record<string, unknown>).mock as Record<string, unknown[][]>;
      expect(mock.calls).toEqual([['arg1', 'arg2']]);
    });

    it('should support mockReturnValue', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockReturnValue as (v: unknown) => void)(42);
      expect((mockFn as unknown as (...a: unknown[]) => unknown)()).toBe(42);
    });

    it('should support mockClear', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn as unknown as (...a: unknown[]) => unknown)('x');
      (mockFn.mockClear as () => void)();
      const mock = mockFn.mock as Record<string, unknown[]>;
      expect(mock.calls).toEqual([]);
      expect(mock.results).toEqual([]);
    });
  });
});

describe('createIpcInterceptor buildBrowserIpcInjectionScript delegation', () => {
  it('should delegate to the ElectronAdapter', () => {
    const interceptor = createIpcInterceptor('electron');
    const script = interceptor.buildBrowserIpcInjectionScript();
    expect(script).toContain('window.__wdio_spy__');
    expect(script).toContain('ipcRenderer');
  });
});
