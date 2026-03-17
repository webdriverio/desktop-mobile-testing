import { assert, describe, expect, it } from 'vitest';
import { Err, isErr, isOk, map, mapErr, Ok, unwrap, unwrapOr, wrapAsync } from '../src/result.js';

describe('Ok', () => {
  it('should create an Ok result', () => {
    const result = Ok(42);
    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('should work with non-primitive values', () => {
    const result = Ok({ name: 'test' });
    expect(result).toEqual({ ok: true, value: { name: 'test' } });
  });
});

describe('Err', () => {
  it('should create an Err result', () => {
    const error = new Error('fail');
    const result = Err(error);
    expect(result).toEqual({ ok: false, error });
  });

  it('should work with string errors', () => {
    const result = Err('something went wrong');
    expect(result).toEqual({ ok: false, error: 'something went wrong' });
  });
});

describe('isOk', () => {
  it('should return true for Ok results', () => {
    expect(isOk(Ok(1))).toBe(true);
  });

  it('should return false for Err results', () => {
    expect(isOk(Err('fail'))).toBe(false);
  });
});

describe('isErr', () => {
  it('should return true for Err results', () => {
    expect(isErr(Err('fail'))).toBe(true);
  });

  it('should return false for Ok results', () => {
    expect(isErr(Ok(1))).toBe(false);
  });
});

describe('unwrap', () => {
  it('should return the value for Ok results', () => {
    expect(unwrap(Ok('hello'))).toBe('hello');
  });

  it('should throw the error for Err results', () => {
    const error = new Error('boom');
    expect(() => unwrap(Err(error))).toThrow(error);
  });
});

describe('unwrapOr', () => {
  it('should return the value for Ok results', () => {
    expect(unwrapOr(Ok(10), 0)).toBe(10);
  });

  it('should return the default for Err results', () => {
    expect(unwrapOr(Err('fail'), 0)).toBe(0);
  });
});

describe('map', () => {
  it('should transform Ok values', () => {
    const result = map(Ok(2), (x) => x * 3);
    expect(result).toEqual({ ok: true, value: 6 });
  });

  it('should pass through Err unchanged', () => {
    const error = new Error('fail');
    const result = map(Err(error), (x: number) => x * 3);
    expect(result).toEqual({ ok: false, error });
  });
});

describe('mapErr', () => {
  it('should transform Err errors', () => {
    const result = mapErr(Err('not found'), (e) => new Error(e));
    assert(!result.ok);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('not found');
  });

  it('should pass through Ok unchanged', () => {
    const result = mapErr(Ok(42), () => new Error('ignored'));
    expect(result).toEqual({ ok: true, value: 42 });
  });
});

describe('wrapAsync', () => {
  it('should wrap a resolved promise as Ok', async () => {
    const result = await wrapAsync(Promise.resolve('data'));
    expect(result).toEqual({ ok: true, value: 'data' });
  });

  it('should wrap a rejected Error as Err', async () => {
    const error = new Error('async fail');
    const result = await wrapAsync(Promise.reject(error));
    expect(result).toEqual({ ok: false, error });
  });

  it('should wrap a rejected non-Error as Err with wrapped message', async () => {
    const result = await wrapAsync(Promise.reject('string rejection'));
    assert(!result.ok);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('string rejection');
  });
});
