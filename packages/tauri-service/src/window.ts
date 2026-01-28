import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'window');

interface DevtoolsEndpoint {
  webSocketDebuggerUrl: string;
  type: string;
  id: string;
  title: string;
  url: string;
}

const windowPortMap = new Map<string, number>();
const lastCommandCache = new Map<string, string>();

const DOM_COMMANDS = ['click', 'keys', 'doubleClick', 'rightClick', 'setValue', 'clearValue', '$', '$$'];

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

  // Map endpoints by their ID (which corresponds to window label in Tauri)
  for (const endpoint of endpoints) {
    const port = extractPortFromWebSocketUrl(endpoint.webSocketDebuggerUrl);
    // The endpoint id typically matches the window label (e.g., "main", "secondary")
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

async function switchToWindow(browser: WebdriverIO.Browser, newPort: number): Promise<void> {
  log.debug(`Switching to window on port ${newPort}`);

  const originalSessionId = browser.sessionId;

  try {
    await browser.deleteSession();
    log.debug(`Deleted session ${originalSessionId}`);

    await browser.newSession({
      'goog:chromeOptions': {
        debuggerAddress: `localhost:${newPort}`,
      },
    });
    log.debug(`Created new session on port ${newPort}`);
  } catch (error) {
    log.error('Failed to switch window:', error);
    throw error;
  }
}

function requiresWindowFocus(commandName: string): boolean {
  return DOM_COMMANDS.includes(commandName);
}

export async function ensureActiveWindowFocus(
  browser: WebdriverIO.Browser,
  currentPort: number | undefined,
  commandName: string,
): Promise<number | undefined> {
  if (!currentPort) {
    const port = await getCurrentDevtoolsPort(browser);
    return port;
  }

  if (!requiresWindowFocus(commandName)) {
    return currentPort;
  }

  try {
    const activeLabel = await getActiveWindowLabel(browser);
    const activePort = await getWindowPort(browser, activeLabel);

    if (activePort && activePort !== currentPort) {
      log.debug(`Window change detected: ${currentPort} -> ${activePort} (label: "${activeLabel}")`);
      await switchToWindow(browser, activePort);
      return activePort;
    }

    return currentPort;
  } catch (error) {
    log.warn('Failed to ensure window focus:', error);
    return currentPort;
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
