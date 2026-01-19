/// <reference types="../../@types/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isMockFunction } from '../../src/commands/mock.js';
import { createMock } from '../../src/mock.js';
import mockStore from '../../src/mockStore.js';

describe('isMockFunction Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      tauri: {
        execute: vi.fn(),
      },
      execute: vi.fn(),
      executeAsync: vi.fn().mockResolvedValue(true),
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return true for a Tauri mock', async () => {
    const mockFn = await createMock('get_platform_info');
    mockStore.setMock(mockFn);
    expect(await isMockFunction('get_platform_info')).toBe(true);
  });

  it('should return false for a non-mocked command', async () => {
    expect(await isMockFunction('non_existent_command')).toBe(false);
  });
});
