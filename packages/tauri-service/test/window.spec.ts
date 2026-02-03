import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWindowState,
  ensureActiveWindowFocus,
  getActiveWindowLabel,
  getCurrentDevtoolsPort,
  getLastCommand,
  getWindowPort,
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

  describe('getCurrentDevtoolsPort', () => {
    it('should extract port from debuggerAddress capability', async () => {
      const mockBrowser = {
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:9222',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const result = await getCurrentDevtoolsPort(mockBrowser);
      expect(result).toBe(9222);
    });

    it('should return undefined when no debuggerAddress', async () => {
      const mockBrowser = {
        capabilities: {},
      } as unknown as WebdriverIO.Browser;

      const result = await getCurrentDevtoolsPort(mockBrowser);
      expect(result).toBeUndefined();
    });

    it('should handle different ports', async () => {
      const mockBrowser = {
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:9223',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const result = await getCurrentDevtoolsPort(mockBrowser);
      expect(result).toBe(9223);
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
    it('should return current port for non-DOM commands', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn(),
        },
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:9222',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const result = await ensureActiveWindowFocus(mockBrowser, 'url');
      expect(result).toBe(9222);
      expect(mockBrowser.tauri.execute).not.toHaveBeenCalled();
    });

    it('should check for window change on DOM commands', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce('main').mockResolvedValueOnce(9222),
        },
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:9222',
          },
        },
        deleteSession: vi.fn().mockResolvedValue(undefined),
        newSession: vi.fn().mockResolvedValue({}),
      } as unknown as WebdriverIO.Browser;

      const result = await ensureActiveWindowFocus(mockBrowser, 9222, 'click');
      expect(result).toBe(9222);
      expect(mockBrowser.tauri.execute).toHaveBeenCalled();
    });

    it('should initialize port from capabilities if not provided', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValue('main'),
        },
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:9222',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const result = await ensureActiveWindowFocus(mockBrowser, undefined, 'click');
      expect(result).toBe(9222);
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

  it('should only switch on DOM interaction commands', async () => {
    const mockBrowser = {
      tauri: {
        execute: vi.fn(),
      },
      capabilities: {
        'goog:chromeOptions': {
          debuggerAddress: 'localhost:9222',
        },
      },
    } as unknown as WebdriverIO.Browser;

    const domCommands = ['click', 'keys', 'doubleClick', 'rightClick', 'setValue', 'clearValue', '$', '$$'];

    for (const cmd of domCommands) {
      await ensureActiveWindowFocus(mockBrowser, 9222, cmd);
      expect(mockBrowser.tauri.execute).toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });
});
