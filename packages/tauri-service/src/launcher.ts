import { execSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import { getTauriBinaryPath, getTauriDriverPath, getWebKitWebDriverPath } from './pathResolver.js';
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

    // Log connection info (hostname and port should be set in wdio config)
    const hostname = config.hostname || '127.0.0.1';
    const port = config.port || this.options.tauriDriverPort || 4444;
    log.info(`WDIO will connect to tauri-driver at ${hostname}:${port}`);

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

    // Validate capabilities
    for (const cap of capsList) {
      // Validate that browserName is either not set or set to 'tauri'
      if (cap.browserName && cap.browserName !== 'tauri') {
        throw new Error(`Tauri service only supports 'tauri' browserName, got: ${cap.browserName}`);
      }

      // Get Tauri app binary path from tauri:options
      const tauriOptions = cap['tauri:options'];
      if (!tauriOptions?.application) {
        throw new Error('Tauri application path not specified in tauri:options.application');
      }

      const appBinaryPath = await getTauriBinaryPath(tauriOptions.application);
      log.debug(`App binary: ${appBinaryPath}`);

      // Validate app args if provided
      const appArgs = tauriOptions.args || [];
      if (appArgs.length > 0) {
        log.debug(`App args: ${JSON.stringify(appArgs)}`);
      }

      // Update the application path to the resolved binary path
      tauriOptions.application = appBinaryPath;

      // Ensure browserName is not set (WDIO would try to spawn a driver for it)
      // When hostname and port are set in config, WDIO connects directly to tauri-driver
      if (cap.browserName) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (cap as { browserName?: string }).browserName;
      }
    }

    // Start tauri-driver as a proxy
    await this.startTauriDriver();

    log.debug('Tauri service prepared successfully');
  }

  /**
   * Start worker session
   */
  async onWorkerStart(cid: string, caps: TauriCapabilities | TauriCapabilities[]): Promise<void> {
    log.debug(`Starting Tauri worker session: ${cid}`);

    // Log DISPLAY status but don't set it - let WDIO's autoXvfb handle it
    // Setting it here prevents xvfb-run from wrapping the worker
    if (process.platform === 'linux') {
      log.info(`DISPLAY environment: ${process.env.DISPLAY || 'not set (xvfb-run will set it)'}`);
    }

    // For multiremote, caps might be an array - get the first one for diagnostics
    const firstCap = Array.isArray(caps) ? caps[0] : caps;

    // App binary path is already resolved in onPrepare
    // The application path now points directly to the binary (not the app directory)
    const appBinaryPath = firstCap?.['tauri:options']?.application;
    if (!appBinaryPath) {
      log.warn('Tauri application path not found in capabilities, skipping diagnostics');
      log.debug(`Capabilities structure: ${JSON.stringify(firstCap, null, 2)}`);
      return;
    }

    this.appBinaryPath = appBinaryPath;
    log.debug(`Using app binary path: ${this.appBinaryPath}`);

    // Verify the binary exists (it should, since we resolved it in onPrepare)
    if (!existsSync(this.appBinaryPath)) {
      log.error(`Tauri binary not found: ${this.appBinaryPath}`);
      return;
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
      // Don't manually set DISPLAY - let tauri-driver inherit from environment
      // or handle display connection itself. Setting DISPLAY here causes
      // authorization issues because we don't have matching XAUTHORITY credentials
      const env = { ...process.env };

      if (process.platform === 'linux') {
        log.info(`Starting tauri-driver (DISPLAY from environment: ${env.DISPLAY || 'not set'})`);
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
