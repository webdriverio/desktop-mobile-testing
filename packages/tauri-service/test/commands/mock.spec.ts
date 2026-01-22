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

let mock: any;

beforeEach(async () => {
  mock = (await import('../../src/commands/mock.js')).mock;
});

afterEach(() => {
  vi.resetModules();
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
  });
});
