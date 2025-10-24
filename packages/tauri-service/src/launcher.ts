import { spawn } from 'node:child_process';
import type { Options } from '@wdio/types';
import { createLogger } from './log.js';
import { getTauriBinaryPath, getTauriDriverPath, isTauriAppBuilt } from './pathResolver.js';
import type { TauriCapabilities, TauriServiceGlobalOptions } from './types.js';

const log = createLogger('launcher');

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
  async onPrepare(_config: Options.Testrunner, capabilities: TauriCapabilities[]): Promise<void> {
    log.debug('Preparing Tauri service...');

    // Validate capabilities
    for (const cap of capabilities) {
      if (cap.browserName !== 'tauri') {
        throw new Error(`Tauri service only supports 'tauri' browserName, got: ${cap.browserName}`);
      }
    }

    // Start tauri-driver
    await this.startTauriDriver();

    log.debug('Tauri service prepared successfully');
  }

  /**
   * Start worker session
   */
  async onWorkerStart(cid: string, caps: TauriCapabilities): Promise<void> {
    log.debug(`Starting Tauri worker session: ${cid}`);

    // Resolve app binary path
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

    return new Promise((resolve, reject) => {
      this.tauriDriverProcess = spawn(tauriDriverPath, ['--port', port.toString()], {
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
