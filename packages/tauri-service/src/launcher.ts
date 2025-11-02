import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import getPort from 'get-port';
import { getTauriBinaryPath, getTauriDriverPath, getWebKitWebDriverPath } from './pathResolver.js';
import type { TauriCapabilities, TauriServiceGlobalOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

/**
 * Extract instance ID from capabilities args (e.g., '--browser=A' -> 'A')
 */
function extractInstanceId(caps: TauriCapabilities): string | undefined {
  const args = caps['tauri:options']?.args || [];
  const browserArg = args.find((arg) => arg.startsWith('--browser='));
  return browserArg?.split('=')[1];
}

/**
 * Generate unique data directory for multiremote instance
 */
function generateDataDirectory(instanceId: string): string {
  const baseTempDir = tmpdir();
  const dataDir = join(baseTempDir, `tauri-multiremote-${instanceId}`);

  log.debug(`Generated data directory for instance ${instanceId}: ${dataDir}`);
  return dataDir;
}

// (per-instance env is set when spawning the tauri-driver process)

/**
 * Tauri launcher service
 */
export default class TauriLaunchService {
  private tauriDriverProcess?: ChildProcess;
  private appBinaryPath?: string;
  private tauriDriverProcesses: Map<string, { proc: ChildProcess; port: number; nativePort: number }> = new Map();

  constructor(
    private options: TauriServiceGlobalOptions,
    capabilities: TauriCapabilities,
    config: Options.Testrunner,
  ) {
    log.info('🚀 TauriLaunchService constructor called');
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
    log.info('🚀 TauriLaunchService onPrepare called');
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

    // Multiremote: spawn a dedicated tauri-driver per instance on unique ports
    if (!Array.isArray(capabilities)) {
      const capEntries = Object.entries(capabilities);
      log.info(`Starting ${capEntries.length} tauri-driver instance(s) for multiremote`);

      // Dynamically allocate free ports for each instance sequentially to avoid conflicts
      // Each tauri-driver instance needs two ports: main port and native port
      const allocatedPorts: number[] = [];
      const allocatedNativePorts: number[] = [];
      const basePort = this.options.tauriDriverPort || 4444;
      const baseNativePort = 4445; // Default native port
      const usedPorts = new Set<number>();

      for (let i = 0; i < capEntries.length; i++) {
        // Allocate main port
        const preferredPort = basePort + i;
        const port = await getPort({
          port: preferredPort,
          host: '127.0.0.1',
          exclude: Array.from(usedPorts),
        });
        usedPorts.add(port);
        allocatedPorts.push(port);

        // Allocate native port (each instance needs its own)
        const preferredNativePort = baseNativePort + i;
        const nativePort = await getPort({
          port: preferredNativePort,
          host: '127.0.0.1',
          exclude: Array.from(usedPorts),
        });
        usedPorts.add(nativePort);
        allocatedNativePorts.push(nativePort);

        log.debug(`Allocated ports for instance ${i}: main=${port}, native=${nativePort}`);
      }

      for (let i = 0; i < capEntries.length; i++) {
        const [key, value] = capEntries[i];
        const cap = value.capabilities;
        const instanceId = extractInstanceId(cap) || String(i);

        const dataDir = generateDataDirectory(instanceId);
        const envVarName = process.platform === 'linux' ? 'XDG_DATA_HOME' : 'TAURI_DATA_DIR';
        const env = { ...process.env, [envVarName]: dataDir };

        // Use dynamically allocated ports
        const instancePort = allocatedPorts[i];
        const instanceNativePort = allocatedNativePorts[i];
        const instanceHost = '127.0.0.1';

        // Update capabilities with the allocated port so WDIO connects to the correct port
        (value as { port?: number; hostname?: string }).port = instancePort;
        (value as { port?: number; hostname?: string }).hostname = instanceHost;

        log.info(
          `➡️  Starting tauri-driver for ${key} (ID: ${instanceId}) on ${instanceHost}:${instancePort} ` +
            `(native port: ${instanceNativePort}, data dir: ${dataDir})`,
        );
        try {
          await this.startTauriDriverForInstance(instanceId, instancePort, instanceNativePort, env);
          log.info(`✅ Successfully started tauri-driver for ${key} on port ${instancePort}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log.error(`❌ Failed to start tauri-driver for ${key}: ${errorMsg}`);
          throw error;
        }

        // Wait for driver to fully stabilize before starting the next one
        // This prevents race conditions when multiple drivers start simultaneously
        if (i < capEntries.length - 1) {
          log.debug(`⏳ Waiting 1s for ${instanceId} to stabilize before starting next driver...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } else {
      // Standard session: single shared tauri-driver as before
      // Set up isolation is not necessary; app may use default data dir
      await this.startTauriDriver();
    }

    log.debug('Tauri service prepared successfully');
  }

  // (data directory isolation is handled per spawned driver; no pre-setup needed)

  /**
   * Start worker session
   */
  async onWorkerStart(cid: string, caps: TauriCapabilities | TauriCapabilities[]): Promise<void> {
    log.debug(`Starting Tauri worker session: ${cid}`);

    // Log DISPLAY status
    if (process.platform === 'linux') {
      log.info(`Worker ${cid} DISPLAY: ${process.env.DISPLAY || 'not set'}`);
    }

    // Handle both multiremote and standard capabilities
    let firstCap: TauriCapabilities;
    let instanceId: string | undefined;

    if (Array.isArray(caps)) {
      // Standard capabilities array
      firstCap = caps[0];
    } else {
      // Multiremote capabilities object - extract the first instance
      const capKeys = Object.keys(caps);
      if (capKeys.length > 0) {
        const firstKey = capKeys[0];
        firstCap = (caps as any)[firstKey].capabilities;
        instanceId = extractInstanceId(firstCap);
        log.debug(`Multiremote instance detected: ${firstKey} (ID: ${instanceId})`);
      } else {
        log.warn('No capabilities found in multiremote object');
        return;
      }
    }

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

    // For multiremote instances, ensure data directory isolation is set up
    // The single tauri-driver process will handle multiple sessions
    if (instanceId) {
      log.debug(`Multiremote instance ${instanceId} - data directory isolation already configured`);
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

    // Skip execution tests - Tauri binary needs display which may not be available
    // in onWorkerStart. The binary will be tested during actual session creation.
    log.info('Skipping binary execution tests (require display, tested during session creation)');

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
    const nativePort = 4445; // Default native port for single instance

    log.debug(`Starting tauri-driver on port ${port} (native port: ${nativePort})`);

    // Prepare tauri-driver arguments
    const args = ['--port', port.toString(), '--native-port', nativePort.toString()];

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
   * Start tauri-driver process for a specific multiremote instance
   */
  private async startTauriDriverForInstance(
    instanceId: string,
    port: number,
    nativePort: number,
    env: NodeJS.ProcessEnv,
  ): Promise<void> {
    const tauriDriverPath = getTauriDriverPath();

    log.info(
      `Starting tauri-driver [${instanceId}] on port ${port} (native port: ${nativePort}, path: ${tauriDriverPath})`,
    );
    const args = ['--port', port.toString(), '--native-port', nativePort.toString()];

    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();
    if (nativeDriverPath) {
      args.push('--native-driver', nativeDriverPath);
      log.info(`[${instanceId}] Using native driver: ${nativeDriverPath}`);
    } else {
      log.warn(`[${instanceId}] WARNING: No native driver found`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(tauriDriverPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env,
      });

      log.info(`[${instanceId}] Spawned process with PID: ${proc.pid ?? 'unknown'}`);
      this.tauriDriverProcesses.set(instanceId, { proc, port, nativePort });

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.info(`[${instanceId}] stdout: ${output.trim()}`);
        if (output.includes('tauri-driver started') || output.includes('listening on')) {
          log.info(`✅ tauri-driver [${instanceId}] started on port ${port} (pid: ${proc.pid ?? 'unknown'})`);
          resolve();
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.error(`[${instanceId}] stderr: ${output.trim()}`);
      });

      proc.on('error', (error: Error) => {
        log.error(`❌ Failed to start tauri-driver [${instanceId}]: ${error.message}`);
        reject(error);
      });

      proc.on('exit', (code: number | null, signal: string | null) => {
        if (code !== null && code !== 0) {
          log.error(`❌ tauri-driver [${instanceId}] exited with code ${code}, signal: ${signal}`);
        } else {
          log.debug(`[${instanceId}] Process exited (code: ${code}, signal: ${signal})`);
        }
      });

      setTimeout(() => {
        if (!proc.killed) {
          log.warn(`⚠️  tauri-driver [${instanceId}] startup timeout, assuming ready`);
          resolve();
        }
      }, 30000);
    });

    // Additional readiness: wait until the driver port accepts connections
    log.info(`[${instanceId}] Waiting for TCP port ${port} to open...`);
    await this.waitForPortOpen('127.0.0.1', port, 30000);
    log.info(`[${instanceId}] ✅ TCP port ${port} is open`);

    // Verify the driver is responding to HTTP requests (not just TCP)
    log.info(`[${instanceId}] Waiting for HTTP endpoint to be ready...`);
    await this.waitForHttpReady('127.0.0.1', port, 10000);
    log.info(`[${instanceId}] ✅ HTTP endpoint ready on port ${port}`);

    // Final verification: check process is still alive
    const procInfo = this.tauriDriverProcesses.get(instanceId);
    if (procInfo?.proc.killed) {
      throw new Error(`tauri-driver [${instanceId}] process died during startup`);
    }
    log.info(`[${instanceId}] ✅ Driver fully ready and process alive (PID: ${procInfo?.proc.pid ?? 'unknown'})`);
  }

  /**
   * Wait until a TCP port is accepting connections
   */
  private async waitForPortOpen(host: string, port: number, timeoutMs: number): Promise<void> {
    const started = Date.now();
    const net = await import('node:net');
    while (Date.now() - started < timeoutMs) {
      const isOpen = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        const onError = () => {
          try {
            socket.destroy();
          } catch {}
          resolve(false);
        };
        socket.setTimeout(750);
        socket.once('error', onError);
        socket.once('timeout', onError);
        socket.connect(port, host, () => {
          try {
            socket.end();
          } catch {}
          resolve(true);
        });
      });
      if (isOpen) return;
      await new Promise((r) => setTimeout(r, 250));
    }
    log.warn(`Port ${host}:${port} did not open within ${timeoutMs}ms`);
  }

  /**
   * Wait until the WebDriver HTTP endpoint is responding
   * Verifies the driver is ready to handle HTTP requests, not just TCP connections
   */
  private async waitForHttpReady(host: string, port: number, timeoutMs: number): Promise<void> {
    const started = Date.now();
    const http = await import('node:http');
    while (Date.now() - started < timeoutMs) {
      const isReady = await new Promise<boolean>((resolve) => {
        // Try /status first (standard WebDriver endpoint), fallback to / if not available
        const tryEndpoint = (path: string) => {
          const req = http.get(`http://${host}:${port}${path}`, { timeout: 1000 }, (res) => {
            // Any HTTP response (even 404/500) means the server is up and responding
            res.once('data', () => {});
            res.once('end', () => resolve(true));
          });
          req.once('error', () => {
            // If /status fails, try root endpoint
            if (path === '/status') {
              tryEndpoint('/');
            } else {
              resolve(false);
            }
          });
          req.once('timeout', () => {
            req.destroy();
            if (path === '/status') {
              tryEndpoint('/');
            } else {
              resolve(false);
            }
          });
        };
        tryEndpoint('/status');
      });
      if (isReady) {
        log.debug(`HTTP endpoint ready at http://${host}:${port}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    log.warn(`HTTP endpoint at http://${host}:${port} did not become ready within ${timeoutMs}ms`);
  }

  /**
   * Stop tauri-driver process
   */
  private async stopTauriDriver(): Promise<void> {
    // Stop per-instance drivers if present
    if (this.tauriDriverProcesses.size > 0) {
      for (const [instanceId, { proc }] of this.tauriDriverProcesses.entries()) {
        if (!proc.killed) {
          log.debug(`Stopping tauri-driver [${instanceId}]...`);
          proc.kill('SIGTERM');
        }
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      this.tauriDriverProcesses.clear();
      return;
    }

    // Fallback to single driver mode
    if (this.tauriDriverProcess && !this.tauriDriverProcess.killed) {
      log.debug('Stopping tauri-driver...');
      this.tauriDriverProcess.kill('SIGTERM');
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
