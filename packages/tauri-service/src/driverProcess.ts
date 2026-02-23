import { type ChildProcess, spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import type { Interface as ReadlineInterface } from 'node:readline';
import { createLogger } from '@wdio/native-utils';
import { createLogCapture } from './logCapture.js';
import type { TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

export interface DriverStartOptions {
  mode: 'single' | 'worker' | 'multiremote';
  identifier: string;
  port: number;
  nativePort: number;
  tauriDriverPath: string;
  nativeDriverPath?: string;
  env?: NodeJS.ProcessEnv;
  options: TauriServiceOptions;
  dataDir?: string;
  instanceId?: string;
}

export interface DriverProcessInfo {
  proc: ChildProcess;
  port: number;
  nativePort: number;
  dataDir?: string;
}

/**
 * Manages a single tauri-driver process lifecycle
 */
export class DriverProcess {
  private _proc?: ChildProcess;
  private streamHandlers: ReadlineInterface[] = [];
  private startupTimeout?: ReturnType<typeof setTimeout>;
  private pollTimer?: ReturnType<typeof setTimeout>;
  private readonly startTimeout = 30000; // 30 seconds
  private _port?: number;
  private _nativePort?: number;
  private _dataDir?: string;

  get proc(): ChildProcess | undefined {
    return this._proc;
  }

  get port(): number | undefined {
    return this._port;
  }

  get nativePort(): number | undefined {
    return this._nativePort;
  }

  get dataDir(): string | undefined {
    return this._dataDir;
  }

  async start(options: DriverStartOptions): Promise<DriverProcessInfo> {
    const { identifier, port, nativePort, tauriDriverPath, nativeDriverPath, env, options: serviceOptions } = options;

    this._port = port;
    this._nativePort = nativePort;
    this._dataDir = options.dataDir;

    log.info(`Starting tauri-driver [${identifier}] on port ${port} (native port: ${nativePort})`);

    const args = ['--port', port.toString(), '--native-port', nativePort.toString()];

    if (nativeDriverPath) {
      args.push('--native-driver', nativeDriverPath);
      log.debug(`[${identifier}] Using native driver: ${nativeDriverPath}`);
    }

    return new Promise<DriverProcessInfo>((resolve, reject) => {
      let settled = false;

      const safeResolve = (info: DriverProcessInfo) => {
        if (!settled) {
          settled = true;
          this.cleanupTimeout();
          resolve(info);
        }
      };

      const safeReject = (err: Error) => {
        if (!settled) {
          settled = true;
          this.cleanupTimeout();
          this.cleanup();
          reject(err);
        }
      };

      try {
        const spawnEnv = env ? { ...process.env, ...env } : process.env;

        this._proc = spawn(tauriDriverPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: spawnEnv,
          shell: process.platform === 'win32',
        });

        log.info(`[${identifier}] Spawned process with PID: ${this._proc.pid ?? 'unknown'}`);

        // Set startup timeout
        this.startupTimeout = setTimeout(() => {
          if (!settled) {
            safeReject(new Error(`tauri-driver [${identifier}] failed to start within ${this.startTimeout}ms`));
          }
        }, this.startTimeout);

        // Setup stream handlers
        const stdoutHandler = createLogCapture({
          stream: this._proc.stdout,
          identifier,
          options: serviceOptions,
          onErrorDetected: (message: string) => {
            safeReject(new Error(message));
          },
          instanceId: options.instanceId,
        });

        const stderrHandler = createLogCapture({
          stream: this._proc.stderr,
          identifier,
          options: serviceOptions,
          instanceId: options.instanceId,
        });

        if (stdoutHandler) this.streamHandlers.push(stdoutHandler);
        if (stderrHandler) this.streamHandlers.push(stderrHandler);

        // Handle process exit during startup
        this._proc.once('exit', (code, signal) => {
          if (!settled) {
            safeReject(
              new Error(
                `tauri-driver [${identifier}] exited unexpectedly during startup (code: ${code}, signal: ${signal})`,
              ),
            );
          }
        });

        this._proc.once('error', (err) => {
          safeReject(new Error(`tauri-driver [${identifier}] failed to start: ${err.message}`));
        });

        // Poll for readiness instead of waiting for stdout message
        this.pollForReadiness(identifier, port, nativePort, options.dataDir, safeResolve, safeReject);
      } catch (error) {
        safeReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Poll for driver readiness by checking TCP port and HTTP endpoint
   */
  private async pollForReadiness(
    identifier: string,
    port: number,
    nativePort: number,
    dataDir: string | undefined,
    resolve: (info: DriverProcessInfo) => void,
    reject: (err: Error) => void,
  ): Promise<void> {
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds
    const pollInterval = 100; // 100ms between polls

    const poll = async () => {
      if (!this._proc || this._proc.killed) {
        reject(new Error(`tauri-driver [${identifier}] process died during startup`));
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error(`tauri-driver [${identifier}] failed to become ready within ${timeout}ms`));
        return;
      }

      // Check if TCP port is open
      const isPortOpen = await this.isPortOpen(port, 500);

      if (isPortOpen) {
        // Port is open, check if HTTP endpoint responds
        try {
          await this.waitForHttpReady(port, 1000);
          log.info(`✅ tauri-driver [${identifier}] is ready on port ${port}`);
          resolve({
            proc: this._proc,
            port,
            nativePort,
            dataDir,
          });
          return;
        } catch {
          // Port is open but HTTP not ready yet, continue polling
        }
      }

      // Schedule next poll
      this.pollTimer = setTimeout(poll, pollInterval);
    };

    // Start polling
    poll();
  }

  /**
   * Check if a TCP port is open
   */
  private async isPortOpen(port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const cleanup = () => {
        if (!settled) {
          settled = true;
          socket.destroy();
        }
      };

      socket.setTimeout(timeout);
      socket.once('error', () => {
        cleanup();
        resolve(false);
      });
      socket.once('timeout', () => {
        cleanup();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1', () => {
        cleanup();
        resolve(true);
      });
    });
  }

  /**
   * Wait for HTTP endpoint to respond
   */
  private async waitForHttpReady(port: number, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = http.get(`http://127.0.0.1:${port}/status`, (res) => {
        res.resume();
        request.destroy();
        resolve();
      });

      request.setTimeout(timeout, () => {
        request.destroy();
        reject(new Error('HTTP request timeout'));
      });

      request.on('error', (err) => {
        request.destroy();
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    if (!this._proc || this._proc.killed) {
      return;
    }

    log.debug('Stopping tauri-driver...');
    this._proc.kill('SIGTERM');

    await this.waitForExit();
    this.cleanup();

    // Additional delay to ensure port is fully released
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
  }

  isRunning(): boolean {
    return !!this._proc && !this._proc.killed;
  }

  private async waitForExit(): Promise<void> {
    const stopTimeout = process.env.CI ? 10000 : 5000;

    return new Promise<void>((resolve) => {
      let shutdownTimeout: ReturnType<typeof setTimeout> | null = null;
      let killTimeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (shutdownTimeout) clearTimeout(shutdownTimeout);
        if (killTimeout) clearTimeout(killTimeout);
      };

      const onExit = () => {
        cleanup();
        log.debug('tauri-driver process exited');
        resolve();
      };

      this._proc?.once('exit', onExit);

      shutdownTimeout = setTimeout(() => {
        log.warn(`tauri-driver did not stop gracefully after ${stopTimeout}ms, forcing kill`);
        this._proc?.kill('SIGKILL');

        killTimeout = setTimeout(() => {
          log.warn('tauri-driver force kill timeout, giving up');
          cleanup();
          resolve();
        }, 5000);
      }, stopTimeout);
    });
  }

  private cleanup(): void {
    this.cleanupTimeout();

    // Close all stream handlers
    for (const handler of this.streamHandlers) {
      handler.close();
    }
    this.streamHandlers = [];

    // Remove all listeners
    if (this._proc) {
      this._proc.removeAllListeners('exit');
      this._proc.removeAllListeners('error');
    }
  }

  private cleanupTimeout(): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = undefined;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }
}
