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

  it('sets window.__wdio_spy__ with a fn factory', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(typeof (window.__wdio_spy__ as Record<string, unknown>)?.fn).toBe('function');
  });

  it('creates window.__wdio_mocks__ if absent', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(window.__wdio_mocks__).toEqual({});
  });

  it('does not overwrite existing window.__wdio_mocks__', () => {
    const existing = { greet: () => {} };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { __wdio_mocks__: existing });
    expect(window.__wdio_mocks__).toBe(existing);
  });

  it('creates window.__TAURI_INTERNALS__ if absent', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    expect(typeof (window.__TAURI_INTERNALS__ as Record<string, unknown>)?.invoke).toBe('function');
  });

  it('preserves existing __TAURI_INTERNALS__ object and only patches invoke', () => {
    const existingInternal = { other: 'value' };
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script, { __TAURI_INTERNALS__: existingInternal });
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    expect(internals.other).toBe('value');
    expect(typeof internals.invoke).toBe('function');
  });

  it('invoke rejects with error for unmocked commands', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    const invoke = internals.invoke as (cmd: string, args: unknown) => Promise<unknown>;
    await expect(invoke('unknown_cmd', {})).rejects.toThrow('unmocked Tauri command in browser mode: unknown_cmd');
  });

  it('invoke routes to window.__wdio_mocks__[cmd] when registered', async () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    (window.__wdio_mocks__ as Record<string, unknown>).greet = (_args: unknown) => 'hello';
    const internals = window.__TAURI_INTERNALS__ as Record<string, unknown>;
    const invoke = internals.invoke as (cmd: string, args: unknown) => Promise<unknown>;
    await expect(invoke('greet', { name: 'world' })).resolves.toBe('hello');
  });

  it('fn() creates a mock with empty call history', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const spy = window.__wdio_spy__ as Record<string, unknown>;
    const mockFn = (spy.fn as () => Record<string, unknown>)();
    const mock = mockFn.mock as Record<string, unknown>;
    expect(mock.calls).toEqual([]);
    expect(mock.results).toEqual([]);
    expect(mock.invocationCallOrder).toEqual([]);
  });

  it('fn() records calls and results', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const spy = window.__wdio_spy__ as Record<string, unknown>;
    const mockFn = (spy.fn as () => (...a: unknown[]) => unknown)();
    mockFn('arg1', 'arg2');
    const mock = (mockFn as unknown as Record<string, unknown>).mock as Record<string, unknown[][]>;
    expect(mock.calls).toEqual([['arg1', 'arg2']]);
  });

  it('fn() supports mockReturnValue', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const spy = window.__wdio_spy__ as Record<string, unknown>;
    const mockFn = (spy.fn as () => Record<string, unknown>)();
    (mockFn.mockReturnValue as (v: unknown) => void)(42);
    expect((mockFn as unknown as (...a: unknown[]) => unknown)()).toBe(42);
  });

  it('fn() supports mockClear', () => {
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

  it('fn() supports mockImplementation', () => {
    const script = adapter.buildBrowserIpcInjectionScript();
    const window = runInBrowserContext(script);
    const spy = window.__wdio_spy__ as Record<string, unknown>;
    const mockFn = (spy.fn as () => Record<string, unknown>)();
    (mockFn.mockImplementation as (fn: (x: number) => number) => void)((x: number) => x * 2);
    const result = (mockFn as unknown as (x: number) => number)(5);
    expect(result).toBe(10);
  });
});

describe('createIpcInterceptor buildBrowserIpcInjectionScript delegation', () => {
  it('delegates to the TauriAdapter', () => {
    const interceptor = createIpcInterceptor('tauri');
    const script = interceptor.buildBrowserIpcInjectionScript();
    expect(script).toContain('window.__wdio_spy__');
    expect(script).toContain('window.__TAURI_INTERNALS__');
  });
});
