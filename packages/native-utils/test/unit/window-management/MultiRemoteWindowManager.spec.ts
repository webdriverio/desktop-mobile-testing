import { beforeEach, describe, expect, it } from 'vitest';
import { MultiRemoteWindowManager } from '../../../src/window-management/MultiRemoteWindowManager.js';
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

describe('MultiRemoteWindowManager', () => {
  let multiManager: MultiRemoteWindowManager;
  let managerA: TestWindowManager;
  let managerB: TestWindowManager;
  let managerC: TestWindowManager;

  beforeEach(() => {
    multiManager = new MultiRemoteWindowManager();
    managerA = new TestWindowManager();
    managerB = new TestWindowManager();
    managerC = new TestWindowManager();
  });

  describe('registerInstance', () => {
    it('should register a window manager', () => {
      multiManager.registerInstance('browserA', managerA);
      expect(multiManager.getInstanceNames()).toEqual(['browserA']);
    });

    it('should register multiple window managers', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);
      expect(multiManager.getInstanceNames()).toContain('browserA');
      expect(multiManager.getInstanceNames()).toContain('browserB');
      expect(multiManager.instanceCount).toBe(2);
    });

    it('should overwrite existing manager for same instance', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserA', managerB);
      expect(multiManager.instanceCount).toBe(1);
      expect(multiManager.getInstanceManager('browserA')).toBe(managerB);
    });
  });

  describe('unregisterInstance', () => {
    it('should remove a registered instance', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.unregisterInstance('browserA');
      expect(multiManager.getInstanceNames()).toEqual([]);
    });

    it('should not error when unregistering non-existent instance', () => {
      expect(() => multiManager.unregisterInstance('nonexistent')).not.toThrow();
    });

    it('should only remove specified instance', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);
      multiManager.unregisterInstance('browserA');
      expect(multiManager.getInstanceNames()).toEqual(['browserB']);
    });
  });

  describe('getInstanceManager', () => {
    it('should return registered manager', () => {
      multiManager.registerInstance('browserA', managerA);
      expect(multiManager.getInstanceManager('browserA')).toBe(managerA);
    });

    it('should return undefined for non-existent instance', () => {
      expect(multiManager.getInstanceManager('nonexistent')).toBeUndefined();
    });
  });

  describe('getInstanceNames', () => {
    it('should return empty array when no instances registered', () => {
      expect(multiManager.getInstanceNames()).toEqual([]);
    });

    it('should return all registered instance names', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);
      multiManager.registerInstance('browserC', managerC);

      const names = multiManager.getInstanceNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('browserA');
      expect(names).toContain('browserB');
      expect(names).toContain('browserC');
    });
  });

  describe('getCurrentHandle', () => {
    it('should return undefined for non-existent instance', () => {
      expect(multiManager.getCurrentHandle('nonexistent')).toBeUndefined();
    });

    it('should return current handle from instance manager', () => {
      multiManager.registerInstance('browserA', managerA);
      managerA.setCurrentHandle('window-1');
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-1');
    });

    it('should return correct handles for multiple instances', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);

      managerA.setCurrentHandle('window-a1');
      managerB.setCurrentHandle('window-b1');

      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a1');
      expect(multiManager.getCurrentHandle('browserB')).toBe('window-b1');
    });
  });

  describe('updateAllActiveHandles', () => {
    it('should return empty map when no instances registered', async () => {
      const results = await multiManager.updateAllActiveHandles();
      expect(results.size).toBe(0);
    });

    it('should update handles for all instances', async () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);

      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerB.setMockWindows([{ handle: 'window-b1', type: 'page' }]);

      const results = await multiManager.updateAllActiveHandles();

      expect(results.size).toBe(2);
      expect(results.get('browserA')).toBe(true);
      expect(results.get('browserB')).toBe(true);
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a1');
      expect(multiManager.getCurrentHandle('browserB')).toBe('window-b1');
    });

    it('should return false for instances where handle did not change', async () => {
      multiManager.registerInstance('browserA', managerA);

      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerA.setCurrentHandle('window-a1');

      const results = await multiManager.updateAllActiveHandles();

      expect(results.get('browserA')).toBe(false);
    });

    it('should handle mix of updated and unchanged instances', async () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);

      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerB.setMockWindows([{ handle: 'window-b1', type: 'page' }]);

      // Set browserA to already have correct handle
      managerA.setCurrentHandle('window-a1');

      const results = await multiManager.updateAllActiveHandles();

      expect(results.get('browserA')).toBe(false);
      expect(results.get('browserB')).toBe(true);
    });
  });

  describe('ensureAllActiveWindows', () => {
    it('should return 0 when no instances registered', async () => {
      const count = await multiManager.ensureAllActiveWindows();
      expect(count).toBe(0);
    });

    it('should return count of updated instances', async () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);
      multiManager.registerInstance('browserC', managerC);

      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerB.setMockWindows([{ handle: 'window-b1', type: 'page' }]);
      managerC.setMockWindows([{ handle: 'window-c1', type: 'page' }]);

      const count = await multiManager.ensureAllActiveWindows();
      expect(count).toBe(3);
    });

    it('should return 0 when all instances already have correct handles', async () => {
      multiManager.registerInstance('browserA', managerA);

      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerA.setCurrentHandle('window-a1');

      const count = await multiManager.ensureAllActiveWindows();
      expect(count).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all registered instances', () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);

      multiManager.clear();

      expect(multiManager.instanceCount).toBe(0);
      expect(multiManager.getInstanceNames()).toEqual([]);
    });

    it('should not error when clearing empty manager', () => {
      expect(() => multiManager.clear()).not.toThrow();
    });
  });

  describe('instanceCount', () => {
    it('should return 0 initially', () => {
      expect(multiManager.instanceCount).toBe(0);
    });

    it('should return correct count', () => {
      multiManager.registerInstance('browserA', managerA);
      expect(multiManager.instanceCount).toBe(1);

      multiManager.registerInstance('browserB', managerB);
      expect(multiManager.instanceCount).toBe(2);

      multiManager.unregisterInstance('browserA');
      expect(multiManager.instanceCount).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should manage window lifecycle across multiple instances', async () => {
      multiManager.registerInstance('browserA', managerA);
      multiManager.registerInstance('browserB', managerB);

      // Initial windows
      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);
      managerB.setMockWindows([{ handle: 'window-b1', type: 'page' }]);

      await multiManager.ensureAllActiveWindows();
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a1');
      expect(multiManager.getCurrentHandle('browserB')).toBe('window-b1');

      // Add more windows
      managerA.setMockWindows([
        { handle: 'window-a1', type: 'page' },
        { handle: 'window-a2', type: 'page' },
      ]);

      // Should keep existing handles
      await multiManager.ensureAllActiveWindows();
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a1');

      // Remove window-a1
      managerA.setMockWindows([{ handle: 'window-a2', type: 'page' }]);

      // Should switch to window-a2
      const count = await multiManager.ensureAllActiveWindows();
      expect(count).toBe(1); // Only browserA updated
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a2');
    });

    it('should handle dynamic instance registration', async () => {
      // Start with one instance
      multiManager.registerInstance('browserA', managerA);
      managerA.setMockWindows([{ handle: 'window-a1', type: 'page' }]);

      await multiManager.ensureAllActiveWindows();
      expect(multiManager.instanceCount).toBe(1);

      // Add second instance dynamically
      multiManager.registerInstance('browserB', managerB);
      managerB.setMockWindows([{ handle: 'window-b1', type: 'page' }]);

      await multiManager.ensureAllActiveWindows();
      expect(multiManager.instanceCount).toBe(2);
      expect(multiManager.getCurrentHandle('browserA')).toBe('window-a1');
      expect(multiManager.getCurrentHandle('browserB')).toBe('window-b1');

      // Remove first instance
      multiManager.unregisterInstance('browserA');
      expect(multiManager.instanceCount).toBe(1);
      expect(multiManager.getInstanceManager('browserA')).toBeUndefined();
      expect(multiManager.getInstanceManager('browserB')).toBe(managerB);
    });
  });
});
