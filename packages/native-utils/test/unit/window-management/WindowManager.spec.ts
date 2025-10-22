import { beforeEach, describe, expect, it } from 'vitest';
import type { WindowInfo } from '../../../src/window-management/types.js';
import { WindowManager } from '../../../src/window-management/WindowManager.js';

/**
 * Test implementation of WindowManager
 */
class TestWindowManager extends WindowManager {
  private mockWindows: WindowInfo[] = [];

  setMockWindows(windows: WindowInfo[]) {
    this.mockWindows = windows;
  }

  protected async getAvailableWindows(): Promise<WindowInfo[]> {
    return this.mockWindows;
  }
}

describe('WindowManager', () => {
  let manager: TestWindowManager;

  beforeEach(() => {
    manager = new TestWindowManager();
  });

  describe('getCurrentHandle', () => {
    it('should return undefined initially', () => {
      expect(manager.getCurrentHandle()).toBeUndefined();
    });

    it('should return the set handle', () => {
      manager.setCurrentHandle('window-1');
      expect(manager.getCurrentHandle()).toBe('window-1');
    });
  });

  describe('setCurrentHandle', () => {
    it('should set the current handle', () => {
      manager.setCurrentHandle('window-2');
      expect(manager.getCurrentHandle()).toBe('window-2');
    });

    it('should allow setting to undefined', () => {
      manager.setCurrentHandle('window-1');
      manager.setCurrentHandle(undefined);
      expect(manager.getCurrentHandle()).toBeUndefined();
    });
  });

  describe('getActiveHandle', () => {
    it('should return undefined when no windows available', async () => {
      manager.setMockWindows([]);
      const handle = await manager.getActiveHandle();
      expect(handle).toBeUndefined();
    });

    it('should return first window when no current handle', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);

      const handle = await manager.getActiveHandle();
      expect(handle).toBe('window-1');
    });

    it('should keep current handle if still valid', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
        { handle: 'window-3', type: 'page' },
      ]);

      manager.setCurrentHandle('window-2');
      const handle = await manager.getActiveHandle();
      expect(handle).toBe('window-2');
    });

    it('should return first window if current handle is invalid', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);

      manager.setCurrentHandle('window-99');
      const handle = await manager.getActiveHandle();
      expect(handle).toBe('window-1');
    });
  });

  describe('updateActiveHandle', () => {
    it('should return false when no windows available', async () => {
      manager.setMockWindows([]);
      const updated = await manager.updateActiveHandle();
      expect(updated).toBe(false);
    });

    it('should return true and update handle when switching to new window', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);

      manager.setCurrentHandle('window-99');
      const updated = await manager.updateActiveHandle();

      expect(updated).toBe(true);
      expect(manager.getCurrentHandle()).toBe('window-1');
    });

    it('should return false when current handle is still valid', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);

      manager.setCurrentHandle('window-2');
      const updated = await manager.updateActiveHandle();

      expect(updated).toBe(false);
      expect(manager.getCurrentHandle()).toBe('window-2');
    });

    it('should set handle on first call with no current handle', async () => {
      manager.setMockWindows([{ handle: 'window-1', type: 'page' }]);

      const updated = await manager.updateActiveHandle();

      expect(updated).toBe(true);
      expect(manager.getCurrentHandle()).toBe('window-1');
    });
  });

  describe('isHandleValid', () => {
    beforeEach(() => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);
    });

    it('should return true for valid handle', async () => {
      const isValid = await manager.isHandleValid('window-1');
      expect(isValid).toBe(true);
    });

    it('should return false for invalid handle', async () => {
      const isValid = await manager.isHandleValid('window-99');
      expect(isValid).toBe(false);
    });

    it('should return false when no windows available', async () => {
      manager.setMockWindows([]);
      const isValid = await manager.isHandleValid('window-1');
      expect(isValid).toBe(false);
    });
  });

  describe('getWindowInfo', () => {
    beforeEach(() => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page', url: 'http://example.com', title: 'Example' },
        { handle: 'window-2', type: 'page', url: 'http://test.com', title: 'Test' },
      ]);
    });

    it('should return window info for valid handle', async () => {
      const info = await manager.getWindowInfo('window-1');
      expect(info).toEqual({
        handle: 'window-1',
        type: 'page',
        url: 'http://example.com',
        title: 'Example',
      });
    });

    it('should return undefined for invalid handle', async () => {
      const info = await manager.getWindowInfo('window-99');
      expect(info).toBeUndefined();
    });

    it('should return correct info for second window', async () => {
      const info = await manager.getWindowInfo('window-2');
      expect(info).toEqual({
        handle: 'window-2',
        type: 'page',
        url: 'http://test.com',
        title: 'Test',
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle window lifecycle', async () => {
      // Start with one window
      manager.setMockWindows([{ handle: 'window-1', type: 'page' }]);
      await manager.updateActiveHandle();
      expect(manager.getCurrentHandle()).toBe('window-1');

      // Add second window, should keep first
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
      ]);
      await manager.updateActiveHandle();
      expect(manager.getCurrentHandle()).toBe('window-1');

      // Remove first window, should switch to second
      manager.setMockWindows([{ handle: 'window-2', type: 'page' }]);
      const updated = await manager.updateActiveHandle();
      expect(updated).toBe(true);
      expect(manager.getCurrentHandle()).toBe('window-2');
    });

    it('should handle all windows closing', async () => {
      manager.setMockWindows([{ handle: 'window-1', type: 'page' }]);
      await manager.updateActiveHandle();
      expect(manager.getCurrentHandle()).toBe('window-1');

      // All windows close
      manager.setMockWindows([]);
      await manager.updateActiveHandle();
      // Handle should still be set to last known window
      expect(manager.getCurrentHandle()).toBe('window-1');

      // But it's not valid
      expect(await manager.isHandleValid('window-1')).toBe(false);
    });

    it('should handle multiple window switches', async () => {
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-2', type: 'page' },
        { handle: 'window-3', type: 'page' },
      ]);

      // Start with window-1
      await manager.updateActiveHandle();
      expect(manager.getCurrentHandle()).toBe('window-1');

      // Manually switch to window-2
      manager.setCurrentHandle('window-2');
      expect(manager.getCurrentHandle()).toBe('window-2');

      // Update should keep window-2 (still valid)
      await manager.updateActiveHandle();
      expect(manager.getCurrentHandle()).toBe('window-2');

      // Remove window-2
      manager.setMockWindows([
        { handle: 'window-1', type: 'page' },
        { handle: 'window-3', type: 'page' },
      ]);

      // Should switch to first available (window-1)
      const updated = await manager.updateActiveHandle();
      expect(updated).toBe(true);
      expect(manager.getCurrentHandle()).toBe('window-1');
    });
  });
});
