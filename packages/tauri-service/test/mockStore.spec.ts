import type { TauriMock } from '@wdio/native-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TauriServiceMockStore } from '../src/mockStore.js';

describe('TauriServiceMockStore', () => {
  let store: TauriServiceMockStore;

  beforeEach(() => {
    store = new TauriServiceMockStore();
  });

  describe('setMock', () => {
    it('should store a mock and return it', () => {
      const mock = createMock('tauri.testCommand');
      const result = store.setMock(mock);
      expect(result).toBe(mock);
    });

    it('should overwrite existing mock with same name', () => {
      const mock1 = createMock('tauri.testCommand');
      const mock2 = createMock('tauri.testCommand');
      store.setMock(mock1);
      store.setMock(mock2);
      expect(store.getMock('tauri.testCommand')).toBe(mock2);
    });
  });

  describe('getMock', () => {
    it('should return stored mock', () => {
      const mock = createMock('tauri.testCommand');
      store.setMock(mock);
      expect(store.getMock('tauri.testCommand')).toBe(mock);
    });

    it('should throw error for non-existent mock', () => {
      expect(() => store.getMock('tauri.nonExistent')).toThrow('No mock registered for "tauri.nonExistent"');
    });
  });

  describe('getMocks', () => {
    it('should return empty array when no mocks stored', () => {
      expect(store.getMocks()).toEqual([]);
    });

    it('should return all stored mocks as entries', () => {
      const mock1 = createMock('tauri.command1');
      const mock2 = createMock('tauri.command2');
      store.setMock(mock1);
      store.setMock(mock2);
      const mocks = store.getMocks();
      expect(mocks).toHaveLength(2);
      expect(mocks.map(([name]) => name)).toContain('tauri.command1');
      expect(mocks.map(([name]) => name)).toContain('tauri.command2');
    });
  });

  describe('deleteMock', () => {
    it('should remove mock and return true', () => {
      const mock = createMock('tauri.testCommand');
      store.setMock(mock);
      expect(store.deleteMock('tauri.testCommand')).toBe(true);
      expect(() => store.getMock('tauri.testCommand')).toThrow();
    });

    it('should return false for non-existent mock', () => {
      expect(store.deleteMock('tauri.nonExistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all mocks', () => {
      const mock1 = createMock('tauri.command1');
      const mock2 = createMock('tauri.command2');
      store.setMock(mock1);
      store.setMock(mock2);
      store.clear();
      expect(store.getMocks()).toEqual([]);
    });

    it('should be safe to call on empty store', () => {
      store.clear();
      expect(store.getMocks()).toEqual([]);
    });
  });
});

function createMock(name: string): TauriMock {
  const mock = vi.fn() as unknown as TauriMock;
  mock.getMockName = () => name;
  mock.mockClear = vi.fn().mockResolvedValue(mock);
  mock.mockReset = vi.fn().mockResolvedValue(mock);
  mock.mockRestore = vi.fn().mockResolvedValue(mock);
  mock.update = vi.fn().mockResolvedValue(mock);
  mock.__isTauriMock = true;
  return mock;
}
