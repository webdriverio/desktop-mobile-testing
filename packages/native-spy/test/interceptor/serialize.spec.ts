import { describe, expect, it } from 'vitest';
import { safeJson, serializeHandler } from '../../src/interceptor/serialize.js';

describe('serializeHandler', () => {
  it('captures function source', () => {
    const fn = (x: number) => x * 2;
    const { source } = serializeHandler(fn);
    expect(source).toContain('x * 2');
  });

  it('works for named functions', () => {
    function myFn() {
      return 42;
    }
    const { source } = serializeHandler(myFn);
    expect(source).toContain('42');
  });
});

describe('safeJson', () => {
  it('serializes primitives normally', () => {
    expect(safeJson(42)).toBe('42');
    expect(safeJson('hello')).toBe('"hello"');
    expect(safeJson(null)).toBe('null');
    expect(safeJson(true)).toBe('true');
  });

  it('serializes plain objects normally', () => {
    expect(safeJson({ a: 1 })).toBe('{"a":1}');
  });

  it('serializes Error as wdioError sentinel', () => {
    const err = new Error('boom');
    const result = safeJson(err);
    const parsed = JSON.parse(result) as { __wdioError: boolean; message: string };
    expect(parsed.__wdioError).toBe(true);
    expect(parsed.message).toBe('boom');
  });

  it('preserves Error message through sentinel round-trip', () => {
    const err = new TypeError('type error message');
    const result = safeJson(err);
    const parsed = JSON.parse(result) as { __wdioError: boolean; message: string };
    expect(parsed.message).toBe('type error message');
  });

  it('returns the string "undefined" for undefined input', () => {
    expect(safeJson(undefined)).toBe('undefined');
  });

  it('returns "[unserializable]" for circular references', () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(safeJson(obj)).toBe('"[unserializable]"');
  });
});
