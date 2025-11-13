import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import getPort from 'get-port';
import { forwardLog, type LogLevel } from './logForwarder.js';
import { parseLogLines } from './logParser.js';
import { getTauriAppInfo, getTauriBinaryPath, getTauriDriverPath, getWebKitWebDriverPath } from './pathResolver.js';
import type { TauriCapabilities, TauriServiceGlobalOptions, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');
let specReporterPatched = false;

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
 * Merge global options with capability-specific options
 */
function mergeOptions(
  globalOptions: TauriServiceGlobalOptions,
  capabilityOptions?: TauriServiceOptions,
): TauriServiceOptions {
  return {
    ...globalOptions,
    ...capabilityOptions,
    // Log capture options default to false if not specified
    captureBackendLogs: capabilityOptions?.captureBackendLogs ?? globalOptions.captureBackendLogs ?? false,
    captureFrontendLogs: capabilityOptions?.captureFrontendLogs ?? globalOptions.captureFrontendLogs ?? false,
    backendLogLevel: (capabilityOptions?.backendLogLevel ?? globalOptions.backendLogLevel ?? 'info') as LogLevel,
    frontendLogLevel: (capabilityOptions?.frontendLogLevel ?? globalOptions.frontendLogLevel ?? 'info') as LogLevel,
  };
}

/**
 * Tauri launcher service
 */
export default class TauriLaunchService {
  private tauriDriverProcess?: ChildProcess;
  private appBinaryPath?: string;
  private tauriDriverProcesses: Map<string, { proc: ChildProcess; port: number; nativePort: number }> = new Map();
  private instanceOptions: Map<string, TauriServiceOptions> = new Map();

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

    if (!specReporterPatched) {
      try {
        const specReporterModule = (await import('@wdio/spec-reporter')) as {
          default: {
            prototype: { onRunnerStart: (runner: unknown) => unknown };
            __tauriPatched?: boolean;
          };
        };
        const SpecReporter = specReporterModule.default;
        if (SpecReporter && !SpecReporter.__tauriPatched) {
          SpecReporter.__tauriPatched = true;
          specReporterPatched = true;
          log.debug('Patched @wdio/spec-reporter to display Tauri browser name');
        }
      } catch (error) {
        log.warn(`Failed to patch spec reporter for Tauri display name: ${(error as Error).message}`);
      }
    }

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
      // Validate that browserName is either not set, 'tauri', or 'wry'
      if (cap.browserName && cap.browserName !== 'tauri' && cap.browserName !== 'wry') {
        throw new Error(`Tauri service only supports 'tauri' or 'wry' browserName, got: ${cap.browserName}`);
      }

      // Remove browserName from capabilities before session creation
      // tauri-driver doesn't need it and will reject it during capability matching
      delete (cap as { browserName?: string }).browserName;

      // Get Tauri app binary path from tauri:options
      const tauriOptions = cap['tauri:options'];
      if (!tauriOptions?.application) {
        throw new Error('Tauri application path not specified in tauri:options.application');
      }

      // Store original app path for getting version info
      const originalAppPath = tauriOptions.application;
      const appBinaryPath = await getTauriBinaryPath(originalAppPath);
      log.debug(`App binary: ${appBinaryPath}`);

      // Validate app args if provided
      const appArgs = tauriOptions.args || [];
      if (appArgs.length > 0) {
        log.debug(`App args: ${JSON.stringify(appArgs)}`);
      }

      // Update the application path to the resolved binary path
      tauriOptions.application = appBinaryPath;

      // Don't set browserName - tauri-driver works best with it unset
      // Only set browserVersion for display purposes in test output
      // Note: This will show as "undefined(version)" but at least shows the version
      try {
        const appInfo = await getTauriAppInfo(originalAppPath);
        if (appInfo.version) {
          cap.browserVersion = appInfo.version;
        }
      } catch {
        // If we can't get the version, leave it undefined
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

        log.info(`Allocated ports for instance ${i}: main=${port}, native=${nativePort}`);
      }

      for (let i = 0; i < capEntries.length; i++) {
        const [key, value] = capEntries[i];
        const cap = value.capabilities;
        const instanceId = extractInstanceId(cap) || String(i);

        // Store options for this instance
        const instanceOptions = mergeOptions(this.options, cap['wdio:tauriServiceOptions']);
        this.instanceOptions.set(instanceId, instanceOptions);

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
          `Starting tauri-driver for ${key} (ID: ${instanceId}) on ${instanceHost}:${instancePort} ` +
            `(native port: ${instanceNativePort})`,
        );
        await this.startTauriDriverForInstance(instanceId, instancePort, instanceNativePort, env, instanceOptions);
      }
    } else {
      // Standard session: single shared tauri-driver as before
      // Set up isolation is not necessary; app may use default data dir
      const port = this.options.tauriDriverPort || 4444;
      const hostname = '127.0.0.1';

      await this.startTauriDriver(capsList);

      // Update the capabilities object with hostname and port so WDIO connects to tauri-driver
      // This is necessary for standalone mode where capabilities are passed directly to remote()
      for (const cap of capsList) {
        (cap as { port?: number; hostname?: string }).port = port;
        (cap as { port?: number; hostname?: string }).hostname = hostname;
        log.debug(
          `Set tauri-driver connection on capabilities: ${hostname}:${port}, ` +
            `browserName=${(cap as { browserName?: string }).browserName}, ` +
            `port=${(cap as { port?: number }).port}, ` +
            `hostname=${(cap as { hostname?: string }).hostname}`,
        );
      }
    }

    log.debug('Tauri service prepared successfully');
  }

  // (data directory isolation is handled per spawned driver; no pre-setup needed)

  /**
   * Start worker session
   */
  async onWorkerStart(
    cid: string,
    caps: TauriCapabilities | TauriCapabilities[] | Record<string, { capabilities?: TauriCapabilities }> | undefined,
  ): Promise<void> {
    log.debug(`Starting Tauri worker session: ${cid}`);

    if (!caps) {
      log.warn('onWorkerStart: No capabilities provided, skipping setup');
      return;
    }

    const capsList: TauriCapabilities[] = [];
    let firstCap: TauriCapabilities | undefined;
    let instanceId: string | undefined;

    if (Array.isArray(caps)) {
      for (const cap of caps) {
        if (cap && typeof cap === 'object') {
          capsList.push(cap);
        }
      }

      firstCap = caps[0];
    } else {
      const maybeMultiRemote = caps as Record<string, { capabilities?: TauriCapabilities }>;
      const entries = Object.entries(maybeMultiRemote);
      const isMultiRemote = entries.every((entry) => entry && typeof entry === 'object' && 'capabilities' in entry);

      if (isMultiRemote) {
        for (const [, value] of entries) {
          const cap = value?.capabilities;
          if (cap && typeof cap === 'object') {
            capsList.push(cap);
          }
        }

        const [firstKey, firstValue] = entries[0] ?? [];
        if (firstValue?.capabilities) {
          firstCap = firstValue.capabilities;
          instanceId = extractInstanceId(firstValue.capabilities);
          log.debug(`Multiremote instance detected: ${String(firstKey)} (ID: ${instanceId ?? 'n/a'})`);
        }
      } else if (caps && typeof caps === 'object') {
        const singleCap = caps as TauriCapabilities;
        capsList.push(singleCap);
        firstCap = singleCap;
      }
    }

    if (capsList.length === 0) {
      log.warn('onWorkerStart: No capability objects found to modify');
      return;
    }

    for (const cap of capsList) {
      // Ensure browserName is removed before sending to tauri-driver
      delete (cap as { browserName?: string }).browserName;
    }

    // Log DISPLAY status
    if (process.platform === 'linux') {
      log.info(`Worker ${cid} DISPLAY: ${process.env.DISPLAY || 'not set'}`);
    }

    if (!firstCap) {
      log.warn('onWorkerStart: Unable to determine primary capabilities, skipping further setup');
      return;
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

    // For standalone mode, add a delay to ensure tauri-driver is fully stopped
    // before the next worker starts. This is critical because standalone tests
    // manage their own sessions and stop/start tauri-driver between specs.
    // On Linux CI runners, tauri-driver can take 10+ seconds to fully release port 4444.
    if (cid === 'standalone') {
      const cleanupDelay = process.env.CI ? 7000 : 3000;
      log.debug(`Waiting ${cleanupDelay}ms for tauri-driver cleanup (standalone mode)...`);
      await new Promise<void>((resolve) => setTimeout(resolve, cleanupDelay));
      log.debug('Standalone cleanup delay complete');
    }

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
  private async startTauriDriver(capabilities?: TauriCapabilities[]): Promise<void> {
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

      // Get options for backend log capture (use first capability's options for single instance)
      const firstCap = capabilities?.[0];
      const options = mergeOptions(this.options, firstCap?.['wdio:tauriServiceOptions']);

      this.tauriDriverProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.debug(`tauri-driver stdout: ${output}`);

        // Check if tauri-driver is ready
        if (output.includes('tauri-driver started') || output.includes('listening on')) {
          resolve();
        }

        // Parse and forward logs if enabled
        const parsedLogs = parseLogLines(output);
        let frontendCount = 0;
        for (const parsedLog of parsedLogs) {
          // Forward backend logs
          if (options.captureBackendLogs && parsedLog.source !== 'frontend') {
            const minLevel = (options.backendLogLevel ?? 'info') as LogLevel;
            forwardLog('backend', parsedLog.level, parsedLog.message, minLevel);
          }
          // Forward frontend logs (from attachConsole)
          if (options.captureFrontendLogs && parsedLog.source === 'frontend') {
            const minLevel = (options.frontendLogLevel ?? 'info') as LogLevel;
            forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel);
            frontendCount += 1;
          }
        }
        if (options.captureFrontendLogs && frontendCount === 0) {
          log.debug('No frontend logs detected in tauri-driver stdout chunk');
        }
      });

      this.tauriDriverProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.error(`tauri-driver stderr: ${output}`);

        // Parse and forward logs from stderr if enabled
        const parsedLogs = parseLogLines(output);
        let frontendCount = 0;
        for (const parsedLog of parsedLogs) {
          // Forward backend logs
          if (options.captureBackendLogs && parsedLog.source !== 'frontend') {
            const minLevel = (options.backendLogLevel ?? 'info') as LogLevel;
            forwardLog('backend', parsedLog.level, parsedLog.message, minLevel);
          }
          // Forward frontend logs (from attachConsole)
          if (options.captureFrontendLogs && parsedLog.source === 'frontend') {
            const minLevel = (options.frontendLogLevel ?? 'info') as LogLevel;
            forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel);
            frontendCount += 1;
          }
        }
        if (options.captureFrontendLogs && frontendCount === 0) {
          log.debug('No frontend logs detected in tauri-driver stderr chunk');
        }
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
    options?: TauriServiceOptions,
  ): Promise<void> {
    const tauriDriverPath = getTauriDriverPath();

    log.info(`Starting tauri-driver [${instanceId}] on port ${port} (native port: ${nativePort})`);
    const args = ['--port', port.toString(), '--native-port', nativePort.toString()];

    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();
    if (nativeDriverPath) {
      args.push('--native-driver', nativeDriverPath);
      log.debug(`[${instanceId}] Using native driver: ${nativeDriverPath}`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(tauriDriverPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env,
      });

      log.info(`[${instanceId}] Spawned process with PID: ${proc.pid ?? 'unknown'}`);
      this.tauriDriverProcesses.set(instanceId, { proc, port, nativePort });

      const instanceOptions = options ?? mergeOptions(this.options, undefined);

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.debug(`[${instanceId}] stdout: ${output.trim()}`);
        if (output.includes('tauri-driver started') || output.includes('listening on')) {
          log.info(`✅ tauri-driver [${instanceId}] started successfully on port ${port}`);
          resolve();
        }

        // Parse and forward logs if enabled
        const parsedLogs = parseLogLines(output);
        for (const parsedLog of parsedLogs) {
          // Forward backend logs
          if (instanceOptions.captureBackendLogs && parsedLog.source !== 'frontend') {
            const minLevel = (instanceOptions.backendLogLevel ?? 'info') as LogLevel;
            forwardLog('backend', parsedLog.level, parsedLog.message, minLevel, instanceId);
          }
          // Forward frontend logs (from attachConsole)
          if (instanceOptions.captureFrontendLogs && parsedLog.source === 'frontend') {
            const minLevel = (instanceOptions.frontendLogLevel ?? 'info') as LogLevel;
            forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel, instanceId);
          }
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        log.error(`[${instanceId}] stderr: ${output.trim()}`);

        // Parse and forward logs from stderr if enabled
        const parsedLogs = parseLogLines(output);
        for (const parsedLog of parsedLogs) {
          // Forward backend logs
          if (instanceOptions.captureBackendLogs && parsedLog.source !== 'frontend') {
            const minLevel = (instanceOptions.backendLogLevel ?? 'info') as LogLevel;
            forwardLog('backend', parsedLog.level, parsedLog.message, minLevel, instanceId);
          }
          // Forward frontend logs (from attachConsole)
          if (instanceOptions.captureFrontendLogs && parsedLog.source === 'frontend') {
            const minLevel = (instanceOptions.frontendLogLevel ?? 'info') as LogLevel;
            forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel, instanceId);
          }
        }
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

    // Wait for driver to be ready
    log.debug(`[${instanceId}] Waiting for TCP port ${port} to open...`);
    await this.waitForPortOpen('127.0.0.1', port, 30000);
    log.debug(`[${instanceId}] Waiting for HTTP endpoint to be ready...`);
    await this.waitForHttpReady('127.0.0.1', port, 10000);

    // Verify process is still alive
    const procInfo = this.tauriDriverProcesses.get(instanceId);
    if (procInfo?.proc.killed) {
      throw new Error(`tauri-driver [${instanceId}] process died during startup`);
    }
    log.info(`[${instanceId}] Driver ready on port ${port} (native port: ${nativePort})`);
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

      // Wait for process to exit, with force-kill fallback
      // Use longer timeout on CI where processes can take longer to clean up
      const stopTimeout = process.env.CI ? 10000 : 5000;
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          log.warn(`tauri-driver did not stop gracefully after ${stopTimeout}ms, forcing kill`);
          this.tauriDriverProcess?.kill('SIGKILL');
          // Give SIGKILL a moment to take effect
          setTimeout(resolve, 2000);
        }, stopTimeout);

        this.tauriDriverProcess?.on('exit', () => {
          log.debug('tauri-driver process exited');
          clearTimeout(timeout);
          resolve();
        });
      });

      // Additional delay to ensure port is fully released
      // This is especially important on slower CI runners
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
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
