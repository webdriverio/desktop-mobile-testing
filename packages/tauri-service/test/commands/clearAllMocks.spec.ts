import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { clearAllMocks } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('clearAllMocks Command', () => {
  let mockedGetPlatformInfo: any, mockedReadClipboard: any;

  beforeEach(async () => {
    mockedGetPlatformInfo = {
      getMockName: () => 'tauri.get_platform_info',
      mockClear: vi.fn(),
    };
    mockedReadClipboard = {
      getMockName: () => 'tauri.read_clipboard',
      mockClear: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['tauri.get_platform_info', mockedGetPlatformInfo],
      ['tauri.read_clipboard', mockedReadClipboard],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should clear all mock functions', async () => {
    await clearAllMocks();
    expect(mockedGetPlatformInfo.mockClear).toHaveBeenCalled();
    expect(mockedReadClipboard.mockClear).toHaveBeenCalled();
  });
});
