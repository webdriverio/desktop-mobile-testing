import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { createMock } from '../../src/mock.js';
import mockStore from '../../src/mockStore.js';

vi.mock('../../src/mock.js', () => ({
  createMock: vi.fn(),
}));
vi.mock('../../src/mockStore.js', () => ({
  default: {
    getMock: vi.fn(),
    setMock: vi.fn(),
  },
}));

let mock: typeof import('../../src/commands/mock.js').mock;

beforeEach(async () => {
  mock = (await import('../../src/commands/mock.js')).mock;
});

afterEach(() => {
  vi.resetModules();
  delete (globalThis as any).browser;
});

describe('mock Command', () => {
  let mockedCommand: any;

  beforeEach(async () => {
    mockedCommand = {
      getMockName: () => 'tauri.get_platform_info',
      mockReset: vi.fn(),
    };
  });

  it('should return an existing mock', async () => {
    (mockStore.getMock as Mock).mockReturnValue(mockedCommand);

    const retrievedMock = await mock('get_platform_info');
    expect(mockStore.getMock).toBeCalledWith('tauri.get_platform_info');
    expect(retrievedMock).toStrictEqual(mockedCommand);
  });

  it('should reset an existing mock', async () => {
    (mockStore.getMock as Mock).mockReturnValue(mockedCommand);

    const retrievedMock = await mock('get_platform_info');
    expect(retrievedMock.mockReset).toHaveBeenCalled();
  });

  describe('when there is no existing mock', () => {
    beforeEach(() => {
      (mockStore.getMock as Mock).mockImplementation(() => {
        throw new Error('No mock by that name');
      });
    });

    it('should create a new mock', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      const createdMock = await mock('get_platform_info');
      expect(createdMock.getMockName()).toBe('tauri.get_platform_info');
    });

    it('should put newly created mocks in the store', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      await mock('get_platform_info');
      expect(mockStore.setMock).toBeCalledWith(mockedCommand);
    });

    it('should use this.browser when it has tauri capabilities', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      const browserWithTauri = {
        isMultiremote: false,
        tauri: { execute: vi.fn() },
      } as unknown as WebdriverIO.Browser;

      const context = { browser: browserWithTauri };
      await mock.call(context, 'get_platform_info');

      expect(createMock).toHaveBeenCalledWith('get_platform_info', browserWithTauri);
    });

    it('should fall back to globalThis.browser with tauri capabilities', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      const globalBrowser = {
        isMultiremote: false,
        tauri: { execute: vi.fn() },
      } as unknown as WebdriverIO.Browser;
      globalThis.browser = globalBrowser as any;

      await mock.call({}, 'get_platform_info');

      expect(createMock).toHaveBeenCalledWith('get_platform_info', globalBrowser);
    });

    it('should fall back to globalThis.browser without tauri when not multiremote', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      const globalBrowser = {
        isMultiremote: false,
      } as unknown as WebdriverIO.Browser;
      globalThis.browser = globalBrowser as any;

      await mock.call({}, 'get_platform_info');

      expect(createMock).toHaveBeenCalledWith('get_platform_info', globalBrowser);
    });

    it('should skip multiremote browser on this.browser and use globalThis.browser', async () => {
      (createMock as Mock).mockReturnValue(mockedCommand);

      const multiremoteBrowser = {
        isMultiremote: true,
        tauri: { execute: vi.fn() },
      } as unknown as WebdriverIO.MultiRemoteBrowser;

      const globalBrowser = {
        isMultiremote: false,
        tauri: { execute: vi.fn() },
      } as unknown as WebdriverIO.Browser;
      globalThis.browser = globalBrowser as any;

      const context = { browser: multiremoteBrowser };
      await mock.call(context, 'get_platform_info');

      expect(createMock).toHaveBeenCalledWith('get_platform_info', globalBrowser);
    });

    it('should propagate errors from createMock', async () => {
      (createMock as Mock).mockRejectedValue(new Error('browser.execute failed'));

      await expect(mock.call({}, 'get_platform_info')).rejects.toThrow('browser.execute failed');
    });
  });
});
