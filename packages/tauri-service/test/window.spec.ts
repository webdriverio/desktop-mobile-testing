import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWindowState,
  ensureActiveWindowFocus,
  getActiveWindowLabel,
  getLastCommand,
  listWindowLabels,
  updateLastCommand,
} from '../src/window.js';

describe('window management', () => {
  beforeEach(() => {
    clearWindowState();
  });

  afterEach(() => {
    clearWindowState();
  });

  describe('getActiveWindowLabel', () => {
    it('should return active window label from tauri API', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValue('main'),
        },
      } as unknown as WebdriverIO.Browser;

      const result = await getActiveWindowLabel(mockBrowser);
      expect(result).toBe('main');
      expect(mockBrowser.tauri.execute).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return "main" as fallback on error', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockRejectedValue(new Error('API error')),
        },
      } as unknown as WebdriverIO.Browser;

      const result = await getActiveWindowLabel(mockBrowser);
      expect(result).toBe('main');
    });
  });

  describe('listWindowLabels', () => {
    it('should return list of window labels', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValue(['main', 'splash']),
        },
      } as unknown as WebdriverIO.Browser;

      const result = await listWindowLabels(mockBrowser);
      expect(result).toEqual(['main', 'splash']);
    });

    it('should return ["main"] as fallback on error', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockRejectedValue(new Error('API error')),
        },
      } as unknown as WebdriverIO.Browser;

      const result = await listWindowLabels(mockBrowser);
      expect(result).toEqual(['main']);
    });
  });

  describe('updateLastCommand and getLastCommand', () => {
    it('should store and retrieve last command', () => {
      const mockBrowser = {
        sessionId: 'test-session-123',
      } as unknown as WebdriverIO.Browser;

      updateLastCommand(mockBrowser, 'click');
      const result = getLastCommand(mockBrowser);
      expect(result).toBe('click');
    });

    it('should return undefined for unknown session', () => {
      const mockBrowser = {
        sessionId: 'unknown-session',
      } as unknown as WebdriverIO.Browser;

      const result = getLastCommand(mockBrowser);
      expect(result).toBeUndefined();
    });
  });

  describe('clearWindowState', () => {
    it('should clear all cached window state', () => {
      const mockBrowser = {
        sessionId: 'test-session',
      } as unknown as WebdriverIO.Browser;

      updateLastCommand(mockBrowser, 'click');
      clearWindowState();
      const result = getLastCommand(mockBrowser);
      expect(result).toBeUndefined();
    });
  });

  describe('ensureActiveWindowFocus', () => {
    it('should not check focus for non-DOM commands', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn(),
        },
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'url');
      expect(mockBrowser.tauri.execute).not.toHaveBeenCalled();
    });

    it('should check focus for DOM commands', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce('main'),
        },
        getWindowHandles: vi.fn().mockResolvedValue(['handle1', 'handle2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
        getTitle: vi.fn().mockResolvedValue('main window'),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'getTitle');
      expect(mockBrowser.tauri.execute).toHaveBeenCalled();
    });

    it('should handle when no window states are available', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockRejectedValue(new Error('API error')),
        },
        getWindowHandles: vi.fn().mockResolvedValue(['handle1', 'handle2']),
        getTitle: vi.fn().mockResolvedValue('main window'),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'getTitle');
      expect(mockBrowser.tauri.execute).toHaveBeenCalled();
    });
  });
});

describe('DOM command filtering', () => {
  beforeEach(() => {
    clearWindowState();
  });

  afterEach(() => {
    clearWindowState();
  });

  it('should only switch on specific DOM commands', async () => {
    const mockBrowser = {
      tauri: {
        execute: vi.fn(),
      },
      getWindowHandles: vi.fn().mockResolvedValue(['handle1', 'handle2']),
      switchToWindow: vi.fn().mockResolvedValue(undefined),
      getTitle: vi.fn().mockResolvedValue('main window'),
    } as unknown as WebdriverIO.Browser;

    const domCommands = ['getTitle', 'findElement', 'findElements', '$', '$$', 'elementClick'];

    for (const cmd of domCommands) {
      await ensureActiveWindowFocus(mockBrowser, cmd);
      expect(mockBrowser.tauri.execute).toHaveBeenCalledWith(expect.any(Function));
      vi.clearAllMocks();
    }
  });
});
