import { describe, expect, it } from 'vitest';
import { createIpcInterceptor } from '../../src/interceptor/index.js';

describe('createIpcInterceptor', () => {
  describe('tauri', () => {
    const interceptor = createIpcInterceptor('tauri');

    it('reports tauri framework', () => {
      expect(interceptor.framework).toBe('tauri');
    });

    it('serializeHandler captures function source', () => {
      const fn = () => 42;
      const { source } = interceptor.serializeHandler(fn);
      expect(source).toContain('42');
    });

    it('buildRegistrationScript delegates to adapter', () => {
      const script = interceptor.buildRegistrationScript('cmd');
      expect(script).toContain('__wdio_spy__');
    });

    it('buildSetImplementationScript accepts SerializedHandler', () => {
      const s = interceptor.serializeHandler(() => 1);
      const script = interceptor.buildSetImplementationScript('cmd', s);
      expect(script).toContain('mockImplementation');
    });

    it('buildWithImplementationScript takes function objects', () => {
      const script = interceptor.buildWithImplementationScript(
        'cmd',
        () => 1,
        () => 2,
      );
      expect(script).toContain('withImplementation');
    });

    it('parseCallData returns empty data for null', () => {
      const data = interceptor.parseCallData(null);
      expect(data.calls).toEqual([]);
      expect(data.results).toEqual([]);
      expect(data.invocationCallOrder).toEqual([]);
    });

    it('parseCallData parses valid call data', () => {
      const raw = { calls: [[1, 2]], results: [{ type: 'return', value: 3 }], invocationCallOrder: [0] };
      const data = interceptor.parseCallData(raw);
      expect(data.calls).toEqual([[1, 2]]);
      expect(data.results[0].type).toBe('return');
    });
  });

  describe('electron stub', () => {
    const interceptor = createIpcInterceptor('electron');

    it('reports electron framework', () => {
      expect(interceptor.framework).toBe('electron');
    });

    it('throws Not implemented for buildRegistrationScript', () => {
      expect(() => interceptor.buildRegistrationScript('cmd')).toThrow('Not implemented');
    });
  });

  describe('context management', () => {
    it('starts with empty context', () => {
      const interceptor = createIpcInterceptor('tauri');
      expect(interceptor.getContext()).toEqual({});
    });

    it('initializes with provided context', () => {
      const interceptor = createIpcInterceptor('tauri', { context: { foo: 'bar' } });
      expect(interceptor.getContext()).toEqual({ foo: 'bar' });
    });

    it('setContext merges into existing context', () => {
      const interceptor = createIpcInterceptor('tauri', { context: { a: 1 } });
      interceptor.setContext({ b: 2 });
      expect(interceptor.getContext()).toEqual({ a: 1, b: 2 });
    });

    it('buildContextSeedScript generates a script with context', () => {
      const interceptor = createIpcInterceptor('tauri');
      const script = interceptor.buildContextSeedScript({ x: 99 });
      expect(script).toContain('__wdio_ipc_context__');
      expect(script).toContain('99');
    });
  });
});
