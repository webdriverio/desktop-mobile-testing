import { describe, expect, it } from 'vitest';
import { buildContextSeedScript } from '../../src/interceptor/ipcContext.js';

describe('buildContextSeedScript', () => {
  it('returns a function-like string', () => {
    const script = buildContextSeedScript({ foo: 'bar' });
    expect(script.trim()).toMatch(/^\(_tauri\)/);
  });

  it('includes the serialized context', () => {
    const script = buildContextSeedScript({ count: 3, label: 'test' });
    expect(script).toContain('"count":3');
    expect(script).toContain('"label":"test"');
  });

  it('seeds window.__wdio_ipc_context__ via Object.assign', () => {
    const script = buildContextSeedScript({ x: 1 });
    expect(script).toContain('__wdio_ipc_context__');
    expect(script).toContain('Object.assign');
  });

  it('handles empty context', () => {
    const script = buildContextSeedScript({});
    expect(script).toContain('{}');
  });
});
