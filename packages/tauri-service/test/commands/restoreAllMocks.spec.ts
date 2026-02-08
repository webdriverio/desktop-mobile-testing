import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { restoreAllMocks } from '../../src/commands/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMocks: vi.fn(),
  },
}));

describe('restoreAllMocks Command', () => {
  let mockedGetPlatformInfo: any, mockedReadClipboard: any, mockedWriteClipboard: any;

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
    mockedWriteClipboard = {
      getMockName: () => 'tauri.write_clipboard',
      mockRestore: vi.fn(),
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

  it('should restore all mocks in the injection script when no prefix is provided', async () => {
    await restoreAllMocks();
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function), undefined);
  });

  it('should restore all outer mock functions when no prefix is provided', async () => {
    await restoreAllMocks();
    expect(mockedGetPlatformInfo.mockRestore).toHaveBeenCalled();
    expect(mockedReadClipboard.mockRestore).toHaveBeenCalled();
    expect(mockedWriteClipboard.mockRestore).toHaveBeenCalled();
  });

  it('should restore only mocks matching the command prefix', async () => {
    await restoreAllMocks('read');
    expect(mockedGetPlatformInfo.mockRestore).not.toHaveBeenCalled();
    expect(mockedReadClipboard.mockRestore).toHaveBeenCalled();
    expect(mockedWriteClipboard.mockRestore).not.toHaveBeenCalled();
  });

  it('should pass prefix to browser execute for inner mock filtering', async () => {
    await restoreAllMocks('write');
    expect((globalThis.browser as any).execute).toHaveBeenCalledWith(expect.any(Function), 'write');
  });

  it('should handle prefix that matches no mocks', async () => {
    await restoreAllMocks('nonexistent');
    expect(mockedGetPlatformInfo.mockRestore).not.toHaveBeenCalled();
    expect(mockedReadClipboard.mockRestore).not.toHaveBeenCalled();
    expect(mockedWriteClipboard.mockRestore).not.toHaveBeenCalled();
  });
});
