/// <reference types="../../@types/vitest" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockAll } from '../../src/commands/mock.js';

describe('mockAll Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebdriverIO.Browser;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should clear all mocks in the injection script', async () => {
    await mockAll();
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function));
  });
});
