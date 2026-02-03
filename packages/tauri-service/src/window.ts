import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'window');

interface DevtoolsEndpoint {
  webSocketDebuggerUrl: string;
  type: string;
  id: string;
  title: string;
  url: string;
}

interface WindowState {
  label: string;
  title: string;
  is_visible: boolean;
  is_focused: boolean;
}

const windowPortMap = new Map<string, number>();
const lastCommandCache = new Map<string, string>();

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
    const result = await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|list_windows'));
    return result as string[];
  } catch (error) {
    log.warn('Failed to list window labels:', error);
    return ['main'];
  }
}

async function pollDevtoolsEndpoints(): Promise<DevtoolsEndpoint[]> {
  try {
    const response = await fetch('http://localhost:9222/json');
    return (await response.json()) as DevtoolsEndpoint[];
  } catch (error) {
    log.warn('Failed to poll devtools endpoints:', error);
    return [];
  }
}

export async function getWindowPort(browser: WebdriverIO.Browser, label: string): Promise<number | undefined> {
  if (windowPortMap.has(label)) {
    return windowPortMap.get(label);
  }

  const endpoints = await pollDevtoolsEndpoints();

  if (endpoints.length === 0) {
    return undefined;
  }

  for (const endpoint of endpoints) {
    const port = extractPortFromWebSocketUrl(endpoint.webSocketDebuggerUrl);
    windowPortMap.set(endpoint.id, port);
    log.debug(`Mapped window "${endpoint.id}" to port ${port}`);
  }

  return windowPortMap.get(label);
}

function extractPortFromWebSocketUrl(wsUrl: string): number {
  const match = wsUrl.match(/localhost:(\d+)/);
  return match ? parseInt(match[1], 10) : 9222;
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

    // Try each handle until we find the one with the target title
    for (const handle of handles) {
      try {
        await browser.switchToWindow(handle);
        const title = await browser.getTitle();
        log.debug(`Handle ${handle.substring(0, 8)}... has title: "${title}"`);

        // Check if this is the target window by title
        if (targetTitle.length > 0 && title.includes(targetTitle)) {
          log.debug(`Found target window with handle ${handle.substring(0, 8)}...`);
          return true;
        }
      } catch {
        // Handle might be stale, continue to next
        log.debug(`Handle ${handle.substring(0, 8)}... is stale, skipping`);
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
    const states = await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|get_window_states'));
    return states as WindowState[];
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
    if (currentTitle.includes(activeWindow.title) || activeWindow.title.includes(currentTitle)) {
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

export function clearWindowState(): void {
  windowPortMap.clear();
  lastCommandCache.clear();
}
