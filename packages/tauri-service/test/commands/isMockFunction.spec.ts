/// <reference types="../../@types/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMockFunction } from '../../src/commands/mock.js';
import { createMock } from '../../src/mock.js';

describe('isMockFunction Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      tauri: {
        execute: vi.fn(),
      },
      execute: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true for a Tauri mock', async () => {
    const mockFn = await createMock('get_platform_info');
    expect(isMockFunction(mockFn)).toBe(true);
  });

  it('should return false for a non-mock function', () => {
    const regularFn = () => {};
    expect(isMockFunction(regularFn)).toBe(false);
  });

  it('should return false for non-function values', () => {
    expect(isMockFunction(null)).toBe(false);
    expect(isMockFunction(undefined)).toBe(false);
    expect(isMockFunction({})).toBe(false);
    expect(isMockFunction('string')).toBe(false);
    expect(isMockFunction(42)).toBe(false);
  });

  it('should return false for a function without __isTauriMock property', () => {
    const fn = () => {};
    expect(isMockFunction(fn)).toBe(false);
  });

  it('should return false for a function with __isTauriMock set to false', () => {
    const fn = (() => {}) as any;
    fn.__isTauriMock = false;
    expect(isMockFunction(fn)).toBe(false);
  });
});
