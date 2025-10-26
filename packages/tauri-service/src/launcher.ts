import { spawn } from 'node:child_process';
import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import { getTauriBinaryPath, getTauriDriverPath, getWebKitWebDriverPath, isTauriAppBuilt } from './pathResolver.js';
import type { TauriCapabilities, TauriServiceGlobalOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

/**
 * Tauri launcher service
 */
export default class TauriLaunchService {
  private tauriDriverProcess?: import('node:child_process').ChildProcess;
  private appBinaryPath?: string;

  constructor(
    private options: TauriServiceGlobalOptions,
    capabilities: TauriCapabilities,
    config: Options.Testrunner,
  ) {
    log.debug('TauriLaunchService initialized');
    log.debug('Capabilities:', JSON.stringify(capabilities, null, 2));
    log.debug('Config:', JSON.stringify(config, null, 2));
  }

  /**
   * Prepare the Tauri service
   */
  async onPrepare(
    _config: Options.Testrunner,
    capabilities: TauriCapabilities[] | Record<string, { capabilities: TauriCapabilities }>,
  ): Promise<void> {
    log.debug('Preparing Tauri service...');

    // Check for unsupported platforms
    if (process.platform === 'darwin') {
      const errorMessage =
        'Tauri testing is not supported on macOS due to WKWebView WebDriver limitations. ' +
        'Please run tests on Windows or Linux. ' +
        'For more information, see: https://v2.tauri.app/develop/tests/webdriver/';
      log.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Handle both standard array and multiremote object capabilities
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities).map((multiremoteOption) => multiremoteOption.capabilities);

    // Validate and convert capabilities
    for (const cap of capsList) {
      if (cap.browserName !== 'tauri') {
        throw new Error(`Tauri service only supports 'tauri' browserName, got: ${cap.browserName}`);
      }

      // Convert browserName to Chrome (WebDriverIO doesn't natively support 'tauri')
      cap.browserName = 'chrome' as TauriCapabilities['browserName'];

      // Set a default browser version for Tauri
      cap.browserVersion = cap.browserVersion || '120.0.6099.109';

      // Get Tauri app binary path from tauri:options
      const appPath = cap['tauri:options']?.application;
      if (!appPath) {
        throw new Error('Tauri application path not specified in tauri:options.application');
      }

      const appBinaryPath = await getTauriBinaryPath(appPath);

      // Get Tauri app args from capabilities
      const appArgs = cap['tauri:options']?.args || [];
      log.debug(`App binary: ${appBinaryPath}`);
      log.debug(`App args: ${JSON.stringify(appArgs)}`);

      // Set up Chrome options to use the Tauri app binary
      // Chrome args go first, then app args are passed to the binary
      cap['goog:chromeOptions'] = {
        binary: appBinaryPath,
        args: [
          '--remote-debugging-port=0',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
          '--mute-audio',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          // Add Tauri app args after Chrome args
          ...appArgs,
        ],
        prefs: {
          'profile.password_manager_leak_detection': false,
          'profile.default_content_setting_values.notifications': 2,
        },
      };

      // Disable WebDriver Bidi session
      cap['wdio:enforceWebDriverClassic'] = true;
    }

    // Start tauri-driver as a proxy
    await this.startTauriDriver();

    log.debug('Tauri service prepared successfully');
  }

  /**
   * Start worker session
   */
  async onWorkerStart(cid: string, caps: TauriCapabilities): Promise<void> {
    log.debug(`Starting Tauri worker session: ${cid}`);

    // App binary path is already resolved in onPrepare
    const appPath = caps['tauri:options']?.application;
    if (!appPath) {
      throw new Error('Tauri application path not specified in capabilities');
    }

    this.appBinaryPath = await getTauriBinaryPath(appPath);
    log.debug(`Resolved app binary path: ${this.appBinaryPath}`);

    // Check if app is built
    const isBuilt = await isTauriAppBuilt(appPath);
    if (!isBuilt) {
      throw new Error(`Tauri app is not built: ${appPath}. Please build the app first.`);
    }

    log.debug(`Tauri worker session started: ${cid}`);
  }

  /**
   * End worker session
   */
  async onWorkerEnd(cid: string): Promise<void> {
    log.debug(`Ending Tauri worker session: ${cid}`);
    // Cleanup handled in onComplete
  }

  /**
   * Complete service lifecycle
   */
  async onComplete(_exitCode: number, _config: Options.Testrunner, _capabilities: TauriCapabilities[]): Promise<void> {
    log.debug('Completing Tauri service...');

    // Stop tauri-driver
    await this.stopTauriDriver();

    log.debug('Tauri service completed');
  }

  /**
   * Start tauri-driver process
   */
  private async startTauriDriver(): Promise<void> {
    const tauriDriverPath = getTauriDriverPath();
    const port = this.options.tauriDriverPort || 4444;

    log.debug(`Starting tauri-driver on port ${port}`);

    // Prepare tauri-driver arguments
    const args = ['--port', port.toString()];

    // Resolve native driver path (WebKitWebDriver on Linux)
    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();

    if (nativeDriverPath) {
      args.push('--native-driver', nativeDriverPath);
      log.debug(`Using native driver: ${nativeDriverPath}`);
    }

    return new Promise((resolve, reject) => {
      this.tauriDriverProcess = spawn(tauriDriverPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      this.tauriDriverProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.debug(`tauri-driver stdout: ${output}`);

        // Check if tauri-driver is ready
        if (output.includes('tauri-driver started') || output.includes('listening on')) {
          resolve();
        }
      });

      this.tauriDriverProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.error(`tauri-driver stderr: ${output}`);
      });

      this.tauriDriverProcess.on('error', (error: Error) => {
        log.error(`Failed to start tauri-driver: ${error.message}`);
        reject(error);
      });

      this.tauriDriverProcess.on('exit', (code: number) => {
        if (code !== 0) {
          log.error(`tauri-driver exited with code ${code}`);
          reject(new Error(`tauri-driver exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.tauriDriverProcess && !this.tauriDriverProcess.killed) {
          log.warn('tauri-driver startup timeout, assuming ready');
          resolve();
        }
      }, 30000);
    });
  }

  /**
   * Stop tauri-driver process
   */
  private async stopTauriDriver(): Promise<void> {
    if (this.tauriDriverProcess && !this.tauriDriverProcess.killed) {
      log.debug('Stopping tauri-driver...');

      this.tauriDriverProcess.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          log.warn('tauri-driver did not stop gracefully, forcing kill');
          this.tauriDriverProcess?.kill('SIGKILL');
          resolve();
        }, 5000);

        this.tauriDriverProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }

  /**
   * Get tauri-driver status
   */
  getTauriDriverStatus(): { running: boolean; pid?: number } {
    return {
      running: this.tauriDriverProcess ? !this.tauriDriverProcess.killed : false,
      pid: this.tauriDriverProcess?.pid,
    };
  }
}
