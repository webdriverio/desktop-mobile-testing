import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@wdio/native-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@wdio/native-utils')>();
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  };
});

vi.mock('../src/mockStore.js', () => ({
  default: {
    deleteMock: vi.fn(),
    getMock: vi.fn(),
    setMock: vi.fn(),
  },
}));

vi.mock('../src/commands/execute.js', () => ({
  execute: vi.fn(),
}));

import { execute as tauriExecute } from '../src/commands/execute.js';
import { createMock } from '../src/mock.js';
import mockStore from '../src/mockStore.js';

const mockExecute = vi.mocked(tauriExecute);

function makeBrowser(): WebdriverIO.Browser {
  return { isMultiremote: false } as unknown as WebdriverIO.Browser;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('createMock', () => {
  it('calls tauriExecute once for registration (registration + initial mockClear are combined)', async () => {
    const browser = makeBrowser();
    await createMock('my_cmd', browser);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('returns a TauriMock with __isTauriMock', async () => {
    const browser = makeBrowser();
    const mock = await createMock('my_cmd', browser);
    expect(mock.__isTauriMock).toBe(true);
  });

  it('mock name is set to tauri.<command>', async () => {
    const browser = makeBrowser();
    const mock = await createMock('platform_info', browser);
    expect(mock.getMockName()).toBe('tauri.platform_info');
  });

  describe('update()', () => {
    it('populates calls from parsed call data', async () => {
      const browser = makeBrowser();
      mockExecute.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        calls: [['arg1'], ['arg2']],
        results: [
          { type: 'return', value: 'a' },
          { type: 'return', value: 'b' },
        ],
        invocationCallOrder: [0, 1],
      });

      const mock = await createMock('my_cmd', browser);
      await mock.update();

      expect(mock.mock.calls).toHaveLength(2);
      expect(mock.mock.calls[0]).toEqual(['arg1']);
      expect(mock.mock.calls[1]).toEqual(['arg2']);
    });

    it('does not duplicate existing calls on a second update', async () => {
      const browser = makeBrowser();
      const syncPayload = {
        calls: [['arg1']],
        results: [{ type: 'return', value: 'x' }],
        invocationCallOrder: [0],
      };
      mockExecute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(syncPayload)
        .mockResolvedValueOnce(syncPayload);

      const mock = await createMock('my_cmd', browser);
      await mock.update();
      await mock.update();

      expect(mock.mock.calls).toHaveLength(1);
    });

    it('uses fallback result when syncData.results entry is missing', async () => {
      const browser = makeBrowser();
      mockExecute.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
        calls: [['arg1']],
        results: [],
        invocationCallOrder: [],
      });

      const mock = await createMock('my_cmd', browser);
      await mock.update();

      expect(mock.mock.results[0]).toEqual({ type: 'return', value: undefined });
    });

    it('returns a mock object for chaining', async () => {
      const browser = makeBrowser();
      mockExecute
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ calls: [], results: [], invocationCallOrder: [] });

      const mock = await createMock('my_cmd', browser);
      const result = await mock.update();
      expect(typeof result).toBe('function');
      expect((result as { __isTauriMock?: boolean }).__isTauriMock).toBe(true);
    });
  });

  describe('mockReset() race-condition hack', () => {
    it('preserves mock name after mockReset', async () => {
      const browser = makeBrowser();
      const mock = await createMock('my_cmd', browser);
      const nameBefore = mock.getMockName();

      mockExecute.mockResolvedValueOnce(undefined);
      await mock.mockReset();

      expect(mock.getMockName()).toBe(nameBefore);
    });

    it('restores async mockClear (not the sync outerMockClear) after mockReset completes', async () => {
      const browser = makeBrowser();
      const mock = await createMock('my_cmd', browser);

      mockExecute.mockResolvedValueOnce(undefined);
      await mock.mockReset();

      // After mockReset, calling mockClear should again go through tauriExecute (async path)
      // If the sync outerMockClear was accidentally left in place, mockExecute wouldn't be called
      mockExecute.mockResolvedValueOnce(undefined);
      await mock.mockClear();
      expect(mockExecute).toHaveBeenCalled();
    });

    it('clears calls after mockReset', async () => {
      const browser = makeBrowser();
      const syncPayload = { calls: [['arg']], results: [{ type: 'return', value: 1 }], invocationCallOrder: [0] };
      mockExecute.mockResolvedValueOnce(undefined).mockResolvedValueOnce(syncPayload).mockResolvedValueOnce(undefined);

      const mock = await createMock('my_cmd', browser);
      await mock.update();
      expect(mock.mock.calls).toHaveLength(1);

      await mock.mockReset();
      expect(mock.mock.calls).toHaveLength(0);
    });
  });

  describe('mockRestore()', () => {
    it('calls mockStore.deleteMock with the tauri-prefixed name', async () => {
      const browser = makeBrowser();
      const mock = await createMock('my_cmd', browser);

      mockExecute.mockResolvedValueOnce(undefined);
      await mock.mockRestore();

      expect(mockStore.deleteMock).toHaveBeenCalledWith('tauri.my_cmd');
    });
  });

  describe('wrapperMock', () => {
    it('wrapperMock.mock returns the outer mock state', async () => {
      const browser = makeBrowser();
      const wrapper = await createMock('my_cmd', browser);
      expect(wrapper.mock).toBeDefined();
      expect(Array.isArray(wrapper.mock.calls)).toBe(true);
    });

    it('wrapperMock.update is bound and functional', async () => {
      const browser = makeBrowser();
      const wrapper = await createMock('my_cmd', browser);

      mockExecute.mockResolvedValueOnce({ calls: [], results: [], invocationCallOrder: [] });
      const result = await wrapper.update();
      expect(result).toBeDefined();
    });
  });
});
