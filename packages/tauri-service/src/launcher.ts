import { execSync, spawn } from 'node:child_process';
import { statSync } from 'node:fs';
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
    config: Options.Testrunner,
    capabilities: TauriCapabilities[] | Record<string, { capabilities: TauriCapabilities }>,
  ): Promise<void> {
    log.debug('Preparing Tauri service...');

    // Configure WDIO to connect to tauri-driver instead of spawning ChromeDriver
    const tauriDriverPort = this.options.tauriDriverPort || 4444;
    config.hostname = config.hostname || 'localhost';
    config.port = config.port || tauriDriverPort;
    log.info(`Configuring WDIO to connect to tauri-driver at ${config.hostname}:${config.port}`);

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

      // Build Chrome args array
      const chromeArgs = [
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
      ];

      log.info(`🚀 Chrome args (${chromeArgs.length} total):`);
      for (let i = 0; i < chromeArgs.length; i++) {
        log.debug(`  [${i}] ${chromeArgs[i]}`);
      }

      // Set up Chrome options to use the Tauri app binary
      cap['goog:chromeOptions'] = {
        binary: appBinaryPath,
        args: chromeArgs,
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

    // On Linux, ensure DISPLAY is set in the worker process environment
    // This is needed for ChromeDriver and any diagnostic commands
    if (process.platform === 'linux' && !process.env.DISPLAY) {
      process.env.DISPLAY = ':99';
      log.info(`Set DISPLAY=${process.env.DISPLAY} in worker process for ChromeDriver and diagnostics`);
    }

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

    // Run environment diagnostics
    await this.diagnoseEnvironment(this.appBinaryPath);

    log.debug(`Tauri worker session started: ${cid}`);
  }

  /**
   * Diagnose the environment before running tests
   */
  private async diagnoseEnvironment(binaryPath: string): Promise<void> {
    log.info('🔍 Running Tauri environment diagnostics...');

    // 1. Check platform and environment
    log.info(`Platform: ${process.platform} ${process.arch}`);
    log.info(`Node version: ${process.version}`);
    log.info(`DISPLAY: ${process.env.DISPLAY || 'not set'}`);
    log.info(`XVFB running: ${process.env.XVFB_RUN || 'unknown'}`);

    // 2. Check binary file permissions
    try {
      const stats = statSync(binaryPath);
      const mode = (stats.mode & 0o777).toString(8);
      log.info(`Binary permissions: ${mode}`);
      log.info(`Binary is executable: ${(stats.mode & 0o111) !== 0}`);
      log.info(`Binary size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      log.error(`Failed to stat binary: ${error instanceof Error ? error.message : error}`);
    }

    // 3. Check shared library dependencies (Linux only)
    if (process.platform === 'linux') {
      try {
        log.info('Checking shared library dependencies...');
        const lddOutput = execSync(`ldd "${binaryPath}"`, { encoding: 'utf8', timeout: 5000 });
        const missing = lddOutput.split('\n').filter((line) => line.includes('not found'));

        if (missing.length > 0) {
          log.error('❌ Missing shared libraries:');
          for (const line of missing) {
            log.error(`  ${line.trim()}`);
          }
        } else {
          log.info('✅ All shared libraries found');
        }

        // Show webkit2gtk specifically since it's critical for Tauri
        const webkitLibs = lddOutput.split('\n').filter((line) => line.includes('webkit'));
        if (webkitLibs.length > 0) {
          log.info('WebKit libraries:');
          for (const line of webkitLibs) {
            log.info(`  ${line.trim()}`);
          }
        }
      } catch (error) {
        log.warn(`Could not check shared libraries: ${error instanceof Error ? error.message : error}`);
      }
    }

    // 4. Try to execute binary with --help to see if it runs at all
    if (process.platform === 'linux') {
      try {
        log.info('Testing if binary can execute at all...');
        const testOutput = execSync(
          `DISPLAY=${process.env.DISPLAY || ':99'} "${binaryPath}" --help 2>&1 || echo "failed"`,
          {
            encoding: 'utf8',
            timeout: 3000,
          },
        );

        if (testOutput.includes('failed') || testOutput.includes('error')) {
          log.error(`❌ Binary failed to execute:\n${testOutput}`);
        } else {
          log.info('✅ Binary can execute');
        }
      } catch (error) {
        log.warn(`Could not test binary execution: ${error instanceof Error ? error.message : error}`);
      }
    }

    // 5. Try to get binary version/info
    try {
      log.info('Checking if binary responds to --version...');
      const versionOutput = execSync(`"${binaryPath}" --version 2>&1 || true`, {
        encoding: 'utf8',
        timeout: 5000,
      });
      if (versionOutput.trim()) {
        log.info(`Binary version output: ${versionOutput.trim()}`);
      }
    } catch (error) {
      log.debug(`Binary does not respond to --version: ${error instanceof Error ? error.message : error}`);
    }

    // 6. Check Chrome/Chromium dependencies (Linux only)
    if (process.platform === 'linux') {
      log.info('Checking for Chrome/Chromium dependencies...');

      const requiredPackages = [
        'libgtk-3-0',
        'libgbm1',
        'libasound2',
        'libatk-bridge2.0-0',
        'libcups2',
        'libdrm2',
        'libxkbcommon0',
        'libxcomposite1',
        'libxdamage1',
        'libxrandr2',
      ];

      for (const pkg of requiredPackages) {
        try {
          execSync(`dpkg -s ${pkg} > /dev/null 2>&1`, { timeout: 1000 });
          log.debug(`✅ ${pkg} is installed`);
        } catch {
          log.warn(`⚠️  ${pkg} may not be installed`);
        }
      }
    }

    // 7. Check WebKitWebDriver availability (Linux only)
    if (process.platform === 'linux') {
      const webkitDriver = getWebKitWebDriverPath();
      if (webkitDriver) {
        log.info(`✅ WebKitWebDriver found: ${webkitDriver}`);
      } else {
        log.warn('⚠️  WebKitWebDriver not found - tests may fail');
      }
    }

    // 8. Check available disk space
    try {
      const df = execSync('df -h . 2>&1 || true', { encoding: 'utf8', timeout: 2000 });
      log.info(`Disk space:\n${df}`);
    } catch {
      // Ignore
    }

    log.info('✅ Diagnostics complete\n');
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
      // On Linux, explicitly set DISPLAY for xvfb compatibility
      const env = { ...process.env };
      if (process.platform === 'linux') {
        env.DISPLAY = env.DISPLAY || ':99';
        log.info(`Setting DISPLAY=${env.DISPLAY} for tauri-driver and children`);
      }

      this.tauriDriverProcess = spawn(tauriDriverPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env,
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
