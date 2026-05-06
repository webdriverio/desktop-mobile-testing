import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createIpcInterceptor } from '../../src/interceptor/index.js';
import { TauriAdapter } from '../../src/interceptor/tauri.js';

function runInBrowserContext(script: string, windowProps: Record<string, unknown> = {}) {
  const window: Record<string, unknown> = { ...windowProps };
  const ctx = vm.createContext({ window, Promise });
  vm.runInContext(script, ctx);
  return window;
}

describe('TauriAdapter.buildBrowserIpcInjectionScript', () => {
  const adapter = new TauriAdapter();

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
    const existing = { greet: () => {} };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { __wdio_mocks__: existing });
    expect(window.__wdio_mocks__).toBe(existing);
  });

  it('should create window.__TAURI_INTERNALS__ if absent', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(typeof (window.__TAURI_INTERNALS__ as Record<string, unknown>)?.invoke).toBe('function');
  });

  it('should preserve existing __TAURI_INTERNALS__ object and only patch invoke', () => {
    const existingInternal = { other: 'value' };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { __TAURI_INTERNALS__: existingInternal });
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    expect(internals.other).toBe('value');
    expect(typeof internals.invoke).toBe('function');
  });

  it('should invoke reject with error for unmocked commands', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    const invoke = internals.invoke as (cmd: string, args: unknown) => Promise<unknown>;
    await expect(invoke('unknown_cmd', {})).rejects.toThrow('unmocked Tauri command in browser mode: unknown_cmd');
  });

  it('should invoke route to window.__wdio_mocks__[cmd] when registered', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    (window.__wdio_mocks__ as Record<string, unknown>).greet = (_args: unknown) => 'hello';
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    const invoke = internals.invoke as (cmd: string, args: unknown) => Promise<unknown>;
    await expect(invoke('greet', { name: 'world' })).resolves.toBe('hello');
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

    it('should support mockImplementation', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockImplementation as (fn: (x: number) => number) => void)((x: number) => x * 2);
      const result = (mockFn as unknown as (x: number) => number)(5);
      expect(result).toBe(10);
    });

    it('fn() mockResolvedValue(undefined) returns Promise.resolve(undefined)', async () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockResolvedValue as (v: unknown) => void)(undefined);
      const result = (mockFn as unknown as () => unknown)();
      expect(result).toBeInstanceOf(Promise);
      await expect(result as Promise<unknown>).resolves.toBeUndefined();
    });

    it('fn() mockRejectedValue(undefined) returns Promise.reject(undefined)', async () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockRejectedValue as (v: unknown) => void)(undefined);
      const result = (mockFn as unknown as () => unknown)();
      expect(result).toBeInstanceOf(Promise);
      await expect(result as Promise<unknown>).rejects.toBeUndefined();
    });

    it('fn() mockClear preserves queued once-implementations', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockReturnValueOnce as (v: unknown) => void)(99);
      (mockFn.mockClear as () => void)();
      const result = (mockFn as unknown as () => unknown)();
      expect(result).toBe(99);
    });

    it('fn() mockReset drains queued once-implementations', () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockReturnValueOnce as (v: unknown) => void)(99);
      (mockFn.mockReset as () => void)();
      const result = (mockFn as unknown as () => unknown)();
      expect(result).toBeUndefined();
    });

    it('should return a rejected Promise for mockRejectedValue', async () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockRejectedValue as (v: unknown) => void)(new Error('oops'));
      const result = (mockFn as unknown as () => Promise<unknown>)();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('oops');
    });

    it('should return a rejected Promise for mockRejectedValueOnce', async () => {
      const script = adapter.buildBrowserIpcInjectionScript();
      const window = runInBrowserContext(script);
      const spy = window.__wdio_spy__ as Record<string, unknown>;
      const mockFn = (spy.fn as () => Record<string, unknown>)();
      (mockFn.mockRejectedValueOnce as (v: unknown) => void)(new Error('once'));
      const result = (mockFn as unknown as () => Promise<unknown>)();
      expect(result).toBeInstanceOf(Promise);
      await expect(result).rejects.toThrow('once');
    });
  });
});

describe('createIpcInterceptor buildBrowserIpcInjectionScript delegation', () => {
  it('should delegate to the TauriAdapter', () => {
    const interceptor = createIpcInterceptor('tauri');
    const script = interceptor.buildBrowserIpcInjectionScript();
    expect(script).toContain('window.__wdio_spy__');
    expect(script).toContain('window.__TAURI_INTERNALS__');
  });
});
