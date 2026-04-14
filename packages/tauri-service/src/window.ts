import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'window');

interface WindowState {
  label: string;
  title: string;
  is_visible: boolean;
  is_focused: boolean;
}

const lastCommandCache = new Map<string, string>();

const currentWindowLabelCache = new Map<string, string>();

const DEFAULT_WINDOW_LABEL = 'main';

export function getDefaultWindowLabel(): string {
  return DEFAULT_WINDOW_LABEL;
}

export function getCurrentWindowLabel(browser: WebdriverIO.Browser): string {
  return currentWindowLabelCache.get(browser.sessionId || 'default') || DEFAULT_WINDOW_LABEL;
}

export function setCurrentWindowLabel(browser: WebdriverIO.Browser, label: string): void {
  currentWindowLabelCache.set(browser.sessionId || 'default', label);
  log.debug(`Current window label set to: ${label}`);
}

export async function switchWindowByLabel(browser: WebdriverIO.Browser, label: string): Promise<void> {
  const availableWindows = await listWindowLabels(browser);

  if (!availableWindows.includes(label)) {
    throw new Error(`Window label "${label}" not found. Available windows: ${availableWindows.join(', ')}`);
  }

  const windowStates = await getWindowStates(browser);

  if (windowStates.length === 0) {
    throw new Error(
      `Unable to retrieve window states. Cannot switch to "${label}". The wdio plugin may not be responding.`,
    );
  }

  const targetWindow = windowStates.find((w) => w.label === label);

  if (!targetWindow) {
    throw new Error(
      `Window with label "${label}" not found in window states. Available: ${windowStates.map((w) => w.label).join(', ')}`,
    );
  }

  const switched = await switchToWindowByTitle(browser, targetWindow.title);
  if (!switched) {
    throw new Error(`Failed to switch to window with label "${label}" (title: "${targetWindow.title}")`);
  }

  setCurrentWindowLabel(browser, label);
  log.debug(`Successfully switched to window: ${label}`);
}

export async function getActiveWindowLabel(browser: WebdriverIO.Browser): Promise<string> {
  try {
    const result = await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|get_active_window_label'));
    return result as string;
  } catch (error) {
    log.warn('Failed to get active window label:', error);
    return 'main';
  }
}

export async function listWindowLabels(browser: WebdriverIO.Browser): Promise<string[]> {
  try {
    const result = await browser.execute(() => {
      // @ts-expect-error - Running in browser context
      if (typeof window.wdioTauri === 'undefined' || typeof window.wdioTauri.execute !== 'function') {
        return JSON.stringify({ __wdio_error__: 'wdioTauri not available' });
      }
      try {
        // @ts-expect-error - Running in browser context
        const execResult = window.wdioTauri.execute(
          // @ts-expect-error - Running in browser context
          ({ core }) => core.invoke('plugin:wdio|list_windows'),
          {},
          '[]',
        );
        if (execResult && typeof execResult.then === 'function') {
          return execResult.then((r: unknown) => JSON.stringify({ __wdio_value__: r }));
        }
        return JSON.stringify({ __wdio_value__: execResult });
      } catch (e) {
        return JSON.stringify({ __wdio_error__: String(e) });
      }
    });
    if (!result || typeof result !== 'string') {
      throw new Error(`Expected string but got ${typeof result}`);
    }
    const parsed = JSON.parse(result) as { __wdio_error__?: string; __wdio_value__?: unknown };
    if (parsed.__wdio_error__) {
      throw new Error(parsed.__wdio_error__);
    }
    if (!Array.isArray(parsed.__wdio_value__)) {
      throw new Error(`Expected array but got ${typeof parsed.__wdio_value__}`);
    }
    return parsed.__wdio_value__ as string[];
  } catch (error) {
    log.error('Failed to list window labels:', error);
    throw new Error(`Failed to list window labels: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getCurrentDevtoolsPort(browser: WebdriverIO.Browser): Promise<number | undefined> {
  const caps = browser.capabilities as Record<string, unknown>;
  const chromeOpts = caps['goog:chromeOptions'] as Record<string, unknown> | undefined;

  if (chromeOpts?.debuggerAddress) {
    const match = (chromeOpts.debuggerAddress as string).match(/localhost:(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  return undefined;
}

async function switchToWindowByTitle(browser: WebdriverIO.Browser, targetTitle: string): Promise<boolean> {
  log.debug(`Switching to window with title containing "${targetTitle}"`);

  try {
    const handles = await browser.getWindowHandles();
    log.debug(`Available handles: ${JSON.stringify(handles)}`);

    // Build a mapping from title to handle by checking each window once
    const titleToHandle = new Map<string, string>();

    for (const handle of handles) {
      try {
        await browser.switchToWindow(handle);
        const title = await browser.getTitle();
        log.debug(`Handle ${handle.substring(0, 8)}... has title: "${title}"`);
        titleToHandle.set(title, handle);
      } catch {
        log.debug(`Handle ${handle.substring(0, 8)}... is stale, skipping`);
      }
    }

    // Find the handle with matching title from our cached mapping
    for (const [title, handle] of titleToHandle.entries()) {
      if (targetTitle.length > 0 && title.trim() === targetTitle.trim()) {
        log.debug(`Found target window with handle ${handle.substring(0, 8)}...`);
        await browser.switchToWindow(handle);
        return true;
      }
    }

    log.warn(`Could not find window with title containing "${targetTitle}"`);
    return false;
  } catch (error) {
    log.error('Failed to switch window by title:', error);
    return false;
  }
}

async function getWindowStates(browser: WebdriverIO.Browser): Promise<WindowState[]> {
  try {
    const result = await browser.execute(() => {
      // @ts-expect-error - Running in browser context
      if (typeof window.wdioTauri === 'undefined' || typeof window.wdioTauri.execute !== 'function') {
        return JSON.stringify({ __wdio_error__: 'wdioTauri not available' });
      }
      try {
        // @ts-expect-error - Running in browser context
        const execResult = window.wdioTauri.execute(
          // @ts-expect-error - Running in browser context
          ({ core }) => core.invoke('plugin:wdio|get_window_states'),
          {},
          '[]',
        );
        if (execResult && typeof execResult.then === 'function') {
          return execResult.then((r: unknown) => JSON.stringify({ __wdio_value__: r }));
        }
        return JSON.stringify({ __wdio_value__: execResult });
      } catch (e) {
        return JSON.stringify({ __wdio_error__: String(e) });
      }
    });
    if (!result || typeof result !== 'string') {
      return [];
    }
    const parsed = JSON.parse(result) as { __wdio_error__?: string; __wdio_value__?: unknown };
    if (parsed.__wdio_error__) {
      log.warn('Failed to get window states:', parsed.__wdio_error__);
      return [];
    }
    return parsed.__wdio_value__ as WindowState[];
  } catch (error) {
    log.warn('Failed to get window states:', error);
    return [];
  }
}

function findActiveWindow(states: WindowState[]): WindowState | undefined {
  // For testing, the "active" window is the one that should receive interactions.
  // Priority: 1) Visible AND focused, 2) Visible, 3) Focused, 4) First available
  // This handles platform differences (Windows webview2 vs Linux WebKit)

  // First, try to find a window that is BOTH visible AND focused
  const visibleAndFocusedWindow = states.find((w) => w.is_visible && w.is_focused);
  if (visibleAndFocusedWindow) {
    return visibleAndFocusedWindow;
  }

  // Second, find the first VISIBLE window (prioritize visibility over focus)
  // This is critical for Windows where focused window may not be visible initially
  const visibleWindow = states.find((w) => w.is_visible);
  if (visibleWindow) {
    return visibleWindow;
  }

  // Third, find any focused window (even if not visible - fallback)
  const focusedWindow = states.find((w) => w.is_focused);
  if (focusedWindow) {
    return focusedWindow;
  }

  // Fallback: return the first window (for consistency)
  return states[0];
}

/**
 * Ensure the WebDriver session is focused on the active window
 * Mirrors Electron's ensureActiveWindowFocus() - completely generic
 *
 * @param browser WebdriverIO browser instance
 * @param commandName Name of the command being executed
 * @returns Promise that resolves when focus is ensured
 */
export async function ensureActiveWindowFocus(browser: WebdriverIO.Browser, commandName: string): Promise<void> {
  // Skip auto-focus if the user has explicitly set a window label via switchWindow()
  // This prevents the auto-focus logic from silently undoing explicit switches.
  // Only skip when the label is a non-default value (user explicitly switched, not just initialized).
  const explicitLabel = currentWindowLabelCache.get(browser.sessionId || 'default');
  if (explicitLabel && explicitLabel !== DEFAULT_WINDOW_LABEL) {
    log.debug(`Skipping auto-focus: explicit label "${explicitLabel}" is set`);
    return;
  }

  // Only check for focus on certain commands (like Electron)
  const focusCommands = ['getTitle', 'findElement', 'findElements', '$', '$$', 'elementClick'];
  if (!focusCommands.includes(commandName)) {
    return;
  }

  try {
    // Get all window states from Tauri (like Electron's puppeteer.targets())
    const states = await getWindowStates(browser);

    if (states.length === 0) {
      log.debug('No window states available, skipping focus check');
      return;
    }

    log.debug(`Window states: ${JSON.stringify(states)}`);

    // Find the currently active window (focused or visible)
    const activeWindow = findActiveWindow(states);

    if (!activeWindow) {
      log.debug('No active window found');
      return;
    }

    log.debug(
      `Active window: ${activeWindow.label} (title: "${activeWindow.title}", visible: ${activeWindow.is_visible}, focused: ${activeWindow.is_focused})`,
    );

    // Get current browser title to see if we're already on the right window
    const currentTitle = await browser.getTitle();
    log.debug(`Current browser title: "${currentTitle}"`);

    // If we're already on the active window, no need to switch
    if (currentTitle.trim() === activeWindow.title.trim()) {
      log.debug('Already on active window, no switch needed');
      return;
    }

    // Switch to the active window
    log.debug(`[SERVICE] Switching to active window: ${activeWindow.title}`);
    const switched = await switchToWindowByTitle(browser, activeWindow.title);

    if (switched) {
      log.debug(`[SERVICE] Successfully switched to active window`);
      // Verify the switch worked
      const newTitle = await browser.getTitle();
      log.debug(`[SERVICE] Title after switch: "${newTitle}"`);
    } else {
      log.warn(`[SERVICE] Failed to switch to active window: ${activeWindow.title}`);
    }
  } catch (error) {
    log.warn('Failed to ensure window focus:', error);
  }
}

export function updateLastCommand(browser: WebdriverIO.Browser, commandName: string): void {
  lastCommandCache.set(browser.sessionId || 'default', commandName);
}

export function getLastCommand(browser: WebdriverIO.Browser): string | undefined {
  return lastCommandCache.get(browser.sessionId || 'default');
}

export function clearWindowState(sessionId?: string): void {
  if (sessionId) {
    lastCommandCache.delete(sessionId);
    currentWindowLabelCache.delete(sessionId);
  } else {
    lastCommandCache.clear();
    currentWindowLabelCache.clear();
  }
}
