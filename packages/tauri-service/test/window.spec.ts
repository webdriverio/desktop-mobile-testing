import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWindowState,
  ensureActiveWindowFocus,
  getActiveWindowLabel,
  getCurrentDevtoolsPort,
  getCurrentWindowLabel,
  getDefaultWindowLabel,
  getLastCommand,
  listWindowLabels,
  setCurrentWindowLabel,
  switchWindowByLabel,
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

    it('should throw error on failure', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockRejectedValue(new Error('API error')),
        },
      } as unknown as WebdriverIO.Browser;

      await expect(listWindowLabels(mockBrowser)).rejects.toThrow('Failed to list window labels');
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

    it('should clear a specific session state', () => {
      const browser1 = { sessionId: 'session-1' } as unknown as WebdriverIO.Browser;
      const browser2 = { sessionId: 'session-2' } as unknown as WebdriverIO.Browser;

      updateLastCommand(browser1, 'click');
      updateLastCommand(browser2, 'setValue');

      clearWindowState('session-1');

      expect(getLastCommand(browser1)).toBeUndefined();
      expect(getLastCommand(browser2)).toBe('setValue');
    });

    it('should clear all state when no argument is provided', () => {
      const browser1 = { sessionId: 'session-a' } as unknown as WebdriverIO.Browser;
      const browser2 = { sessionId: 'session-b' } as unknown as WebdriverIO.Browser;

      updateLastCommand(browser1, 'click');
      updateLastCommand(browser2, 'setValue');

      clearWindowState();

      expect(getLastCommand(browser1)).toBeUndefined();
      expect(getLastCommand(browser2)).toBeUndefined();
    });
  });

  describe('getDefaultWindowLabel', () => {
    it('should return "main" as default', () => {
      expect(getDefaultWindowLabel()).toBe('main');
    });
  });

  describe('getCurrentWindowLabel', () => {
    it('should return default for unknown session', () => {
      const mockBrowser = {
        sessionId: 'unknown-session',
      } as unknown as WebdriverIO.Browser;
      expect(getCurrentWindowLabel(mockBrowser)).toBe('main');
    });

    it('should return cached label for session', () => {
      const mockBrowser = {
        sessionId: 'test-session',
      } as unknown as WebdriverIO.Browser;
      setCurrentWindowLabel(mockBrowser, 'settings');
      expect(getCurrentWindowLabel(mockBrowser)).toBe('settings');
    });

    it('should return default for session without cached label', () => {
      const mockBrowser = {
        sessionId: 'new-session',
      } as unknown as WebdriverIO.Browser;
      expect(getCurrentWindowLabel(mockBrowser)).toBe('main');
    });
  });

  describe('setCurrentWindowLabel', () => {
    it('should cache window label for session', () => {
      const mockBrowser = {
        sessionId: 'test-session',
      } as unknown as WebdriverIO.Browser;
      setCurrentWindowLabel(mockBrowser, 'popup');
      expect(getCurrentWindowLabel(mockBrowser)).toBe('popup');
    });
  });

  describe('switchWindowByLabel', () => {
    it('should throw when window label not found', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce(['main', 'settings'])
            .mockResolvedValueOnce([{ label: 'main', title: 'Main', is_visible: true, is_focused: true }]),
        },
        getWindowHandles: vi.fn().mockResolvedValue(['h1']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
        getTitle: vi.fn().mockResolvedValue('Main'),
      } as unknown as WebdriverIO.Browser;

      await expect(switchWindowByLabel(mockBrowser, 'nonexistent')).rejects.toThrow(
        'Window label "nonexistent" not found',
      );
    });

    it('should throw when window title cannot be matched', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce(['main', 'settings'])
            .mockResolvedValueOnce([
              { label: 'settings', title: 'Settings Window Title', is_visible: true, is_focused: true },
            ]),
        },
        getWindowHandles: vi.fn().mockResolvedValue(['h1']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
        getTitle: vi.fn().mockResolvedValue('Different Title'),
      } as unknown as WebdriverIO.Browser;

      await expect(switchWindowByLabel(mockBrowser, 'settings')).rejects.toThrow(
        'Failed to switch to window with label "settings"',
      );
    });

    it('should update current window label on success', async () => {
      const mockBrowser = {
        sessionId: 'test-session',
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce(['main', 'settings'])
            .mockResolvedValueOnce([
              { label: 'settings', title: 'Settings Window', is_visible: true, is_focused: true },
            ]),
        },
        getWindowHandles: vi.fn().mockResolvedValue(['h1']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
        getTitle: vi.fn().mockResolvedValue('Settings Window'),
      } as unknown as WebdriverIO.Browser;

      clearWindowState();
      await switchWindowByLabel(mockBrowser, 'settings');
      expect(getCurrentWindowLabel(mockBrowser)).toBe('settings');
    });

    it('should throw when getWindowStates returns empty array', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce(['main', 'settings']).mockResolvedValueOnce([]),
        },
      } as unknown as WebdriverIO.Browser;

      await expect(switchWindowByLabel(mockBrowser, 'settings')).rejects.toThrow('Unable to retrieve window states');
    });

    it('should throw when label not found in window states', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce(['main', 'settings'])
            .mockResolvedValueOnce([{ label: 'main', title: 'Main', is_visible: true, is_focused: true }]),
        },
      } as unknown as WebdriverIO.Browser;

      await expect(switchWindowByLabel(mockBrowser, 'settings')).rejects.toThrow('not found in window states');
    });
  });

  describe('clearWindowState clears window label cache', () => {
    it('should clear window label cache when clearing all state', () => {
      const mockBrowser = {
        sessionId: 'test-session',
      } as unknown as WebdriverIO.Browser;
      setCurrentWindowLabel(mockBrowser, 'popup');
      clearWindowState();
      expect(getCurrentWindowLabel(mockBrowser)).toBe('main');
    });

    it('should clear specific session window label', () => {
      const browser1 = { sessionId: 'session-1' } as unknown as WebdriverIO.Browser;
      const browser2 = { sessionId: 'session-2' } as unknown as WebdriverIO.Browser;
      setCurrentWindowLabel(browser1, 'popup');
      setCurrentWindowLabel(browser2, 'settings');
      clearWindowState('session-1');
      expect(getCurrentWindowLabel(browser1)).toBe('main');
      expect(getCurrentWindowLabel(browser2)).toBe('settings');
    });
  });

  describe('getCurrentDevtoolsPort', () => {
    it('should extract port from debuggerAddress capability', async () => {
      const mockBrowser = {
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'localhost:12345',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const port = await getCurrentDevtoolsPort(mockBrowser);
      expect(port).toBe(12345);
    });

    it('should return undefined when no debuggerAddress exists', async () => {
      const mockBrowser = {
        capabilities: {
          'goog:chromeOptions': {},
        },
      } as unknown as WebdriverIO.Browser;

      const port = await getCurrentDevtoolsPort(mockBrowser);
      expect(port).toBeUndefined();
    });

    it('should return undefined when no goog:chromeOptions exists', async () => {
      const mockBrowser = {
        capabilities: {},
      } as unknown as WebdriverIO.Browser;

      const port = await getCurrentDevtoolsPort(mockBrowser);
      expect(port).toBeUndefined();
    });

    it('should return undefined when debuggerAddress has no port', async () => {
      const mockBrowser = {
        capabilities: {
          'goog:chromeOptions': {
            debuggerAddress: 'no-port-here',
          },
        },
      } as unknown as WebdriverIO.Browser;

      const port = await getCurrentDevtoolsPort(mockBrowser);
      expect(port).toBeUndefined();
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
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'main', title: 'main window', is_visible: true, is_focused: true }]),
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

    it('should not switch when already on the active window', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'main', title: 'My App', is_visible: true, is_focused: true }]),
        },
        getTitle: vi.fn().mockResolvedValue('My App'),
        getWindowHandles: vi.fn(),
        switchToWindow: vi.fn(),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'findElement');

      expect(mockBrowser.getWindowHandles).not.toHaveBeenCalled();
      expect(mockBrowser.switchToWindow).not.toHaveBeenCalled();
    });

    it('should switch to a different active window when title does not match', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'settings', title: 'Settings', is_visible: true, is_focused: true }]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Main Window')
          .mockResolvedValueOnce('Main Window')
          .mockResolvedValueOnce('Settings'),
        getWindowHandles: vi.fn().mockResolvedValue(['handle1', 'handle2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'findElement');

      expect(mockBrowser.getWindowHandles).toHaveBeenCalled();
    });
  });

  describe('findActiveWindow (via ensureActiveWindowFocus)', () => {
    it('should prefer visible AND focused window', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce([
            { label: 'bg', title: 'Background', is_visible: false, is_focused: false },
            { label: 'main', title: 'Main', is_visible: true, is_focused: true },
            { label: 'other', title: 'Other', is_visible: true, is_focused: false },
          ]),
        },
        getTitle: vi.fn().mockResolvedValue('Background'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2', 'h3']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      (mockBrowser.getTitle as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce('Background')
        .mockResolvedValueOnce('Background')
        .mockResolvedValueOnce('Main')
        .mockResolvedValueOnce('Other')
        .mockResolvedValueOnce('Main');

      await ensureActiveWindowFocus(mockBrowser, '$');

      const switchCalls = (mockBrowser.switchToWindow as ReturnType<typeof vi.fn>).mock.calls;
      const lastHandle = switchCalls[switchCalls.length - 1]?.[0];
      expect(lastHandle).toBe('h2');
    });

    it('should fall back to visible-only window when none are focused', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce([
            { label: 'hidden', title: 'Hidden', is_visible: false, is_focused: false },
            { label: 'visible', title: 'Visible', is_visible: true, is_focused: false },
          ]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Hidden')
          .mockResolvedValueOnce('Hidden')
          .mockResolvedValueOnce('Visible')
          .mockResolvedValueOnce('Visible'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'findElement');

      const switchCalls = (mockBrowser.switchToWindow as ReturnType<typeof vi.fn>).mock.calls;
      const lastHandle = switchCalls[switchCalls.length - 1]?.[0];
      expect(lastHandle).toBe('h2');
    });

    it('should fall back to focused-only window when none are visible', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce([
            { label: 'hidden1', title: 'Hidden1', is_visible: false, is_focused: false },
            { label: 'focused', title: 'Focused', is_visible: false, is_focused: true },
          ]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Hidden1')
          .mockResolvedValueOnce('Hidden1')
          .mockResolvedValueOnce('Focused')
          .mockResolvedValueOnce('Focused'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'findElements');

      const switchCalls = (mockBrowser.switchToWindow as ReturnType<typeof vi.fn>).mock.calls;
      const lastHandle = switchCalls[switchCalls.length - 1]?.[0];
      expect(lastHandle).toBe('h2');
    });

    it('should fall back to first available window when none are visible or focused', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce([
            { label: 'first', title: 'First', is_visible: false, is_focused: false },
            { label: 'second', title: 'Second', is_visible: false, is_focused: false },
          ]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Something Else')
          .mockResolvedValueOnce('First')
          .mockResolvedValueOnce('Second')
          .mockResolvedValueOnce('First'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, '$$');

      const switchCalls = (mockBrowser.switchToWindow as ReturnType<typeof vi.fn>).mock.calls;
      const lastHandle = switchCalls[switchCalls.length - 1]?.[0];
      expect(lastHandle).toBe('h1');
    });

    it('should return early when window states list is empty', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi.fn().mockResolvedValueOnce([]),
        },
        getTitle: vi.fn(),
        getWindowHandles: vi.fn(),
        switchToWindow: vi.fn(),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'getTitle');

      expect(mockBrowser.getTitle).not.toHaveBeenCalled();
      expect(mockBrowser.getWindowHandles).not.toHaveBeenCalled();
    });
  });

  describe('switchToWindowByTitle (via ensureActiveWindowFocus)', () => {
    it('should successfully switch to window matching title', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'target', title: 'Target Window', is_visible: true, is_focused: true }]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Other Window')
          .mockResolvedValueOnce('Other Window')
          .mockResolvedValueOnce('Target Window')
          .mockResolvedValueOnce('Target Window'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await ensureActiveWindowFocus(mockBrowser, 'elementClick');

      expect(mockBrowser.switchToWindow).toHaveBeenCalled();
    });

    it('should handle when no window matches the target title', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'ghost', title: 'Ghost Window', is_visible: true, is_focused: true }]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Current')
          .mockResolvedValueOnce('Window A')
          .mockResolvedValueOnce('Window B'),
        getWindowHandles: vi.fn().mockResolvedValue(['h1', 'h2']),
        switchToWindow: vi.fn().mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await expect(ensureActiveWindowFocus(mockBrowser, 'findElement')).resolves.not.toThrow();
    });

    it('should handle stale window handle gracefully', async () => {
      const mockBrowser = {
        tauri: {
          execute: vi
            .fn()
            .mockResolvedValueOnce([{ label: 'target', title: 'Target', is_visible: true, is_focused: true }]),
        },
        getTitle: vi
          .fn()
          .mockResolvedValueOnce('Current')
          .mockResolvedValueOnce('Target')
          .mockResolvedValueOnce('Target'),
        getWindowHandles: vi.fn().mockResolvedValue(['stale-handle', 'good-handle']),
        switchToWindow: vi.fn().mockRejectedValueOnce(new Error('no such window')).mockResolvedValue(undefined),
      } as unknown as WebdriverIO.Browser;

      await expect(ensureActiveWindowFocus(mockBrowser, 'getTitle')).resolves.not.toThrow();
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
