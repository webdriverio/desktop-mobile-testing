import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { resetAllMocks } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('resetAllMocks Command', () => {
  let mockedGetPlatformInfo: any, mockedReadClipboard: any, mockedWriteClipboard: any;

  beforeEach(async () => {
    globalThis.browser = {
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
    mockedWriteClipboard = {
      getMockName: () => 'tauri.write_clipboard',
      mockReset: vi.fn(),
    };
    (mockStore.getMocks as Mock).mockReturnValue([
      ['tauri.get_platform_info', mockedGetPlatformInfo],
      ['tauri.read_clipboard', mockedReadClipboard],
      ['tauri.write_clipboard', mockedWriteClipboard],
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should reset all mocks in the injection script when no prefix is provided', async () => {
    await resetAllMocks();
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('should reset all outer mock functions when no prefix is provided', async () => {
    await resetAllMocks();
    expect(mockedGetPlatformInfo.mockReset).toHaveBeenCalled();
    expect(mockedReadClipboard.mockReset).toHaveBeenCalled();
    expect(mockedWriteClipboard.mockReset).toHaveBeenCalled();
  });

  it('should reset only mocks matching the command prefix', async () => {
    await resetAllMocks('read');
    expect(mockedGetPlatformInfo.mockReset).not.toHaveBeenCalled();
    expect(mockedReadClipboard.mockReset).toHaveBeenCalled();
    expect(mockedWriteClipboard.mockReset).not.toHaveBeenCalled();
  });

  it('should pass prefix to browser execute for inner mock filtering', async () => {
    await resetAllMocks('write');
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function), 'write');
  });

  it('should handle prefix that matches no mocks', async () => {
    await resetAllMocks('nonexistent');
    expect(mockedGetPlatformInfo.mockReset).not.toHaveBeenCalled();
    expect(mockedReadClipboard.mockReset).not.toHaveBeenCalled();
    expect(mockedWriteClipboard.mockReset).not.toHaveBeenCalled();
  });
});
