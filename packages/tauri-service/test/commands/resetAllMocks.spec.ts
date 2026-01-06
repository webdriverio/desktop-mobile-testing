import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { resetAllMocks } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('resetAllMocks Command', () => {
  let mockedGetPlatformInfo: any, mockedReadClipboard: any;

  beforeEach(async () => {
    globalThis.browser = {
      tauri: {
        execute: vi.fn().mockResolvedValue(undefined),
      },
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebdriverIO.Browser;

    mockedGetPlatformInfo = {
      getMockName: () => 'tauri.get_platform_info',
      mockReset: vi.fn(),
    };
    mockedReadClipboard = {
      getMockName: () => 'tauri.read_clipboard',
      mockReset: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['tauri.get_platform_info', mockedGetPlatformInfo],
      ['tauri.read_clipboard', mockedReadClipboard],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reset all mocks in the Rust plugin', async () => {
    await resetAllMocks();
    expect((globalThis.browser as any).tauri.execute).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should reset all mocks in the injection script', async () => {
    await resetAllMocks();
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should reset all outer mock functions', async () => {
    await resetAllMocks();
    expect(mockedGetPlatformInfo.mockReset).toHaveBeenCalled();
    expect(mockedReadClipboard.mockReset).toHaveBeenCalled();
  });
});
