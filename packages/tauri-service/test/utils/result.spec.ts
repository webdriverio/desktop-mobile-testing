import { Err, isErr, isOk, map, mapErr, Ok, unwrap, unwrapOr, wrapAsync } from '@wdio/native-utils';
import { describe, expect, it } from 'vitest';

describe('Result type', () => {
  describe('Ok', () => {
    it('should create a successful result', () => {
      const result = Ok(42);
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value : undefined).toBe(42);
    });

    it('should work with objects', () => {
      const result = Ok({ name: 'test', count: 5 });
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value.name : undefined).toBe('test');
      expect(result.ok ? result.value.count : undefined).toBe(5);
    });

    it('should work with null values', () => {
      const result = Ok(null);
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value : undefined).toBeNull();
    });
  });

  describe('Err', () => {
    it('should create an error result', () => {
      const result = Err(new Error('something went wrong'));
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error.message : undefined).toBe('something went wrong');
    });

    it('should work with custom error types', () => {
      const customError = { code: 'CUSTOM', message: 'Custom error' };
      const result = Err(customError);
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error.code : undefined).toBe('CUSTOM');
    });
  });

  describe('isOk', () => {
    it('should return true for Ok results', () => {
      expect(isOk(Ok(42))).toBe(true);
    });

    it('should return false for Err results', () => {
      expect(isOk(Err(new Error('test')))).toBe(false);
    });
  });

  describe('isErr', () => {
    it('should return true for Err results', () => {
      expect(isErr(Err(new Error('test')))).toBe(true);
    });

    it('should return false for Ok results', () => {
      expect(isErr(Ok(42))).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return the value for Ok results', () => {
      expect(unwrap(Ok(42))).toBe(42);
    });

    it('should throw the error for Err results', () => {
      const error = new Error('test error');
      expect(() => unwrap(Err(error))).toThrow(error);
    });
  });

  describe('unwrapOr', () => {
    it('should return the value for Ok results', () => {
      expect(unwrapOr(Ok(42), 0)).toBe(42);
    });

    it('should return the default for Err results', () => {
      expect(unwrapOr(Err(new Error('test')), 0)).toBe(0);
    });
  });

  describe('map', () => {
    it('should transform Ok values', () => {
      const result = map(Ok(5), (x) => x * 2);
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value : undefined).toBe(10);
    });

    it('should pass through Err values', () => {
      const error = new Error('test');
      const result = map(Err(error), (x: number) => x * 2);
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error : undefined).toBe(error);
    });
  });

  describe('mapErr', () => {
    it('should pass through Ok values', () => {
      const result = mapErr<number, Error, Error>(Ok(42), (e) => new Error(`mapped: ${e.message}`));
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value : undefined).toBe(42);
    });

    it('should transform Err values', () => {
      const result = mapErr(Err(new Error('original')), (e) => new Error(`wrapped: ${e.message}`));
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error.message : undefined).toBe('wrapped: original');
    });
  });

  describe('wrapAsync', () => {
    it('should wrap successful promises in Ok', async () => {
      const result = await wrapAsync(Promise.resolve(42));
      expect(result.ok).toBe(true);
      expect(result.ok ? result.value : undefined).toBe(42);
    });

    it('should wrap rejected promises in Err', async () => {
      const result = await wrapAsync(Promise.reject(new Error('async error')));
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error.message : undefined).toBe('async error');
    });

    it('should convert non-Error rejections to Error', async () => {
      const result = await wrapAsync(Promise.reject('string error'));
      expect(result.ok).toBe(false);
      expect(!result.ok ? result.error.message : undefined).toBe('string error');
    });
  });
});
