import { spawn } from 'node:child_process';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service', 'triggerDeeplink');

interface TauriServiceContext {
  browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
}

/**
 * Store embedded mode info for access by triggerDeeplink.
 * Uses environment variables since launcher and worker run in separate processes.
 */
export function setEmbeddedModeInfo(isEmbedded: boolean, appBinaryPath?: string): void {
  if (isEmbedded) {
    process.env.__WDIO_TAURI_EMBEDDED__ = 'true';
    if (appBinaryPath) {
      process.env.__WDIO_TAURI_APP_BINARY__ = appBinaryPath;
    }
    log.info(`Set embedded mode env: isEmbedded=true, appBinaryPath=${appBinaryPath}`);
  }
}

/**
 * Get embedded mode info from environment variables.
 */
function getEmbeddedModeInfo(): { isEmbedded: boolean; appBinaryPath?: string } | undefined {
  const isEmbedded = process.env.__WDIO_TAURI_EMBEDDED__ === 'true';
  const appBinaryPath = process.env.__WDIO_TAURI_APP_BINARY__;
  if (!isEmbedded) return undefined;
  return { isEmbedded, appBinaryPath };
}

/**
 * Check if we're running with the embedded WebDriver provider.
 * Uses globally stored info from the launcher.
 */
function isEmbeddedProvider(): boolean {
  const info = getEmbeddedModeInfo();
  return info?.isEmbedded ?? false;
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
 * // Returns { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', 'myapp://test'] }
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
        command: 'rundll32.exe',
        args: ['url.dll,FileProtocolHandler', url],
      };

    case 'darwin':
      return {
        command: 'open',
        args: [url],
      };

    case 'linux':
      return {
        command: 'gio',
        args: ['open', url],
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
 * @param env - Optional environment variables to pass (defaults to process.env for embedded mode)
 * @returns A promise that resolves when the command has been spawned successfully
 * @throws Error if the command fails to spawn
 *
 * @example
 * ```ts
 * await executeDeeplinkCommand('open', ['myapp://test']);
 * ```
 */
export async function executeDeeplinkCommand(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const fullCommand = `${command} ${args.join(' ')}`;
      log.info(`Spawning deeplink command: "${fullCommand}"`);

      const childProcess = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        env: env ?? process.env,
      });

      const pid = childProcess.pid;
      log.info(`Deeplink process spawned with PID: ${pid}`);

      childProcess.unref();

      childProcess.on('error', (error) => {
        log.error(`Failed to spawn deeplink process (PID ${pid}): ${error.message}`);
        reject(new Error(`Failed to trigger deeplink: ${error.message}`));
      });

      process.nextTick(() => {
        log.info(`Deeplink command spawned successfully: PID ${pid}`);
        resolve();
      });
    } catch (error) {
      log.error(`Failed to trigger deeplink: ${error instanceof Error ? error.message : String(error)}`);
      reject(new Error(`Failed to trigger deeplink: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

/**
 * Triggers a deeplink to the Tauri application for testing protocol handlers.
 *
 * For embedded WebDriver:
 * - Uses HTTP POST to the WebDriver server's /__wdio/deeplink endpoint
 * - This bypasses the need for platform-specific single-instance IPC mechanisms
 *   (D-Bus on Linux, NSDistributedNotificationCenter on macOS) which don't work
 *   reliably with unbundled binaries in CI environments.
 *
 * For tauri-driver:
 * - Uses platform-specific commands to open the deeplink URL
 * - Windows: Uses `rundll32.exe url.dll,FileProtocolHandler`
 * - macOS: Uses `open` command
 * - Linux: Uses `gio open` command
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
  log.info(`triggerDeeplink called with URL: ${url}`);

  const validatedUrl = validateDeeplinkUrl(url);
  const platform = process.platform;
  log.info(`Platform: ${platform}`);

  // For embedded mode, use HTTP POST to the WebDriver server's deeplink endpoint.
  // This bypasses the need for platform-specific single-instance IPC mechanisms
  // (D-Bus on Linux, NSDistributedNotificationCenter on macOS) which don't work
  // reliably with unbundled binaries in CI environments.
  if (isEmbeddedProvider()) {
    const port = process.env.TAURI_WEBDRIVER_PORT || '4445';
    const endpoint = `http://127.0.0.1:${port}/__wdio/deeplink`;

    log.info(`Embedded mode: forwarding deeplink via HTTP`);
    log.info(`Endpoint: ${endpoint}`);
    log.info(`URL: ${validatedUrl}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validatedUrl }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const result = (await response.json()) as { success: boolean; url: string };
      log.info(`Deeplink forwarded successfully: ${result.url}`);
      return;
    } catch (error) {
      log.error(`Failed to forward deeplink via HTTP: ${error}`);
      throw new Error(`Failed to forward deeplink: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Standard approach for tauri-driver: use platform-specific commands
  const { command, args } = getPlatformCommand(validatedUrl, platform);
  const fullCommand = `${command} ${args.join(' ')}`;
  log.info(`Full deeplink command: "${fullCommand}"`);

  try {
    await executeDeeplinkCommand(command, args);
    log.info(`Deeplink triggered successfully: ${validatedUrl}`);
  } catch (error) {
    log.error(`Failed to trigger deeplink: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
