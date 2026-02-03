import { spawn } from 'node:child_process';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'triggerDeeplink');

interface TauriServiceContext {
  browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
}

/**
 * Validates that the provided URL is a valid deeplink URL.
 * Rejects http/https/file protocols and ensures the URL is properly formatted.
 *
 * @param url - The URL to validate
 * @returns The validated URL
 * @throws Error if the URL is invalid or uses a disallowed protocol
 *
 * @example
 * ```ts
 * validateDeeplinkUrl('myapp://test'); // Returns 'myapp://test'
 * validateDeeplinkUrl('https://example.com'); // Throws error
 * ```
 */
export function validateDeeplinkUrl(url: string): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid deeplink URL: ${url}`);
  }

  const disallowedProtocols = ['http:', 'https:', 'file:'];
  if (disallowedProtocols.includes(parsedUrl.protocol)) {
    const protocol = parsedUrl.protocol.slice(0, -1);
    throw new Error(`Invalid deeplink protocol: ${protocol}. Expected a custom protocol (e.g., myapp://).`);
  }

  return url;
}

/**
 * Generates the platform-specific command to trigger the deeplink.
 *
 * @param url - The deeplink URL to trigger
 * @param platform - The platform (win32, darwin, linux)
 * @returns Command and arguments for child_process.spawn
 * @throws Error if platform is unsupported
 *
 * @example
 * ```ts
 * // Windows
 * getPlatformCommand('myapp://test', 'win32');
 * // Returns { command: 'cmd', args: ['/c', 'start', '""', '"myapp://test"'] }
 *
 * // macOS
 * getPlatformCommand('myapp://test', 'darwin');
 * // Returns { command: 'open', args: ['myapp://test'] }
 *
 * // Linux
 * getPlatformCommand('myapp://test', 'linux');
 * // Returns { command: 'xdg-open', args: ['myapp://test'] }
 * ```
 */
export function getPlatformCommand(url: string, platform: string): { command: string; args: string[] } {
  switch (platform) {
    case 'win32':
      return {
        command: 'cmd',
        args: ['/c', 'start', '', `"${url}"`],
      };

    case 'darwin':
      return {
        command: 'open',
        args: [url],
      };

    case 'linux':
      return {
        command: 'xdg-open',
        args: [url],
      };

    default:
      throw new Error(
        `Unsupported platform for deeplink triggering: ${platform}. ` +
          'Supported platforms are: win32, darwin, linux.',
      );
  }
}

/**
 * Executes the deeplink command using child_process.spawn.
 * The process is detached and runs asynchronously in the background.
 *
 * @param command - The command to execute
 * @param args - The command arguments
 * @returns A promise that resolves when the command has been spawned successfully
 * @throws Error if the command fails to spawn
 *
 * @example
 * ```ts
 * await executeDeeplinkCommand('open', ['myapp://test']);
 * ```
 */
export async function executeDeeplinkCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const childProcess = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      });

      childProcess.unref();

      childProcess.on('error', (error) => {
        reject(new Error(`Failed to trigger deeplink: ${error.message}`));
      });

      process.nextTick(() => {
        log.debug('Deeplink command spawned successfully');
        resolve();
      });
    } catch (error) {
      reject(new Error(`Failed to trigger deeplink: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

/**
 * Triggers a deeplink to the Tauri application for testing protocol handlers.
 *
 * This method uses platform-specific commands to open the deeplink URL:
 * - Windows: Uses `cmd /c start` to trigger the deeplink
 * - macOS: Uses `open` command
 * - Linux: Uses `xdg-open` command
 *
 * Unlike Electron, Tauri does not have the same userData directory issues
 * on Windows because it uses WebView2 instead of Chromium/Electron's process model.
 *
 * @param this - Service context
 * @param url - The deeplink URL to trigger (e.g., 'myapp://open?path=/test')
 * @returns A promise that resolves when the deeplink has been triggered
 * @throws Error if the URL is invalid or uses http/https/file protocols
 *
 * @example
 * ```ts
 * await browser.tauri.triggerDeeplink('myapp://open?file=test.txt');
 * ```
 */
export async function triggerDeeplink(this: TauriServiceContext, url: string): Promise<void> {
  log.debug(`triggerDeeplink called with URL: ${url}`);

  const validatedUrl = validateDeeplinkUrl(url);
  const platform = process.platform;

  const { command, args } = getPlatformCommand(validatedUrl, platform);
  log.debug(`Executing deeplink command: ${command} ${args.join(' ')}`);

  try {
    await executeDeeplinkCommand(command, args);
    log.debug('Deeplink triggered successfully');
  } catch (error) {
    log.error(`Failed to trigger deeplink: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
