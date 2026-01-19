import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { restoreAllMocks } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('restoreAllMocks Command', () => {
  let mockedGetPlatformInfo: any, mockedReadClipboard: any;

  beforeEach(async () => {
    globalThis.browser = {
      execute: vi.fn().mockResolvedValue(undefined),
    } as unknown as WebdriverIO.Browser;

    mockedGetPlatformInfo = {
      getMockName: () => 'tauri.get_platform_info',
      mockRestore: vi.fn(),
    };
    mockedReadClipboard = {
      getMockName: () => 'tauri.read_clipboard',
      mockRestore: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['tauri.get_platform_info', mockedGetPlatformInfo],
      ['tauri.read_clipboard', mockedReadClipboard],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should restore all mocks in the injection script', async () => {
    await restoreAllMocks();
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should restore all outer mock functions', async () => {
    await restoreAllMocks();
    expect(mockedGetPlatformInfo.mockRestore).toHaveBeenCalled();
    expect(mockedReadClipboard.mockRestore).toHaveBeenCalled();
  });
});
