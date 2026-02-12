import { type ChildProcess, execSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import getPort from 'get-port';
import { startTestRunnerBackend, stopTestRunnerBackend, waitTestRunnerBackendReady } from './crabnebulaBackend.js';
import { ensureTauriDriver, ensureWebKitWebDriver, findTestRunnerBackend } from './driverManager.js';
import { DriverProcess } from './driverProcess.js';
import { ensureMsEdgeDriver } from './edgeDriverManager.js';
import { forwardLog, type LogLevel } from './logForwarder.js';
import { parseLogLine } from './logParser.js';
import { getTauriAppInfo, getTauriBinaryPath, getWebKitWebDriverPath } from './pathResolver.js';
import type { TauriCapabilities, TauriServiceGlobalOptions, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

/**
 * Generate unique data directory for multiremote instance or worker
 */
function generateDataDirectory(instanceId: string): string {
  const baseTempDir = tmpdir();
  // Support both multiremote instances and worker IDs
  const prefix = instanceId.startsWith('worker-') ? 'tauri' : 'tauri-multiremote';
  const dataDir = join(baseTempDir, `${prefix}-${instanceId}`);

  log.debug(`Generated data directory for ${instanceId}: ${dataDir}`);
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
 * Options for setting up readline-based log handling
 */
interface StreamLogHandlerOptions {
  stream: Readable | null;
  streamName: 'stdout' | 'stderr';
  identifier: string;
  options: TauriServiceOptions;
  onStartupDetected?: () => void;
  onErrorDetected?: (message: string) => void;
  instanceId?: string;
}

/**
 * Set up readline-based log handling for a process stream.
 * This ensures complete lines are processed, avoiding Windows buffering issues
 * where partial lines could be received in separate chunks.
 */
function setupStreamLogHandler({
  stream,
  streamName,
  identifier,
  options,
  onStartupDetected,
  onErrorDetected,
  instanceId,
}: StreamLogHandlerOptions): ReadlineInterface | undefined {
  if (!stream) return undefined;

  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  rl.on('line', (line: string) => {
    // Log raw output for debugging
    if (streamName === 'stdout') {
      log.info(`[STDOUT] ${identifier} line: ${line.substring(0, 200)}`);
    } else {
      log.error(`[${identifier}] stderr: ${line}`);
    }

    // Check for startup messages
    if (onStartupDetected && (line.includes('tauri-driver started') || line.includes('listening on'))) {
      log.info(`✅ tauri-driver [${identifier}] started successfully`);
      onStartupDetected();
    }

    // Detect bind failure (tauri-driver prints "can not listen" when port is occupied)
    if (onErrorDetected && line.includes('can not listen')) {
      onErrorDetected(`tauri-driver [${identifier}] failed to bind: ${line}`);
    }

    // Parse and forward log
    const parsedLog = parseLogLine(line);
    if (parsedLog) {
      // Forward backend logs
      if (options.captureBackendLogs && parsedLog.source !== 'frontend') {
        const minLevel = (options.backendLogLevel ?? 'info') as LogLevel;
        forwardLog('backend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
      }
      // Forward frontend logs
      if (options.captureFrontendLogs && parsedLog.source === 'frontend') {
        const minLevel = (options.frontendLogLevel ?? 'info') as LogLevel;
        forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
      }
    }
  });

  return rl;
}

/**
 * Tauri launcher service
 */
export default class TauriLaunchService {
  private driverProcess?: DriverProcess; // Single mode driver
  private testRunnerBackend?: ChildProcess; // CrabNebula backend for macOS
  private appBinaryPath?: string;
  private tauriDriverProcesses: Map<string, { proc: ChildProcess; port: number; nativePort: number }> = new Map();
  private instanceOptions: Map<string, TauriServiceOptions> = new Map();
  private perWorkerMode: boolean = false;
  private perWorkerDrivers: Map<
    string,
    {
      proc: ChildProcess;
      port: number;
      nativePort: number;
      dataDir: string;
    }
  > = new Map();
  private perWorkerDriverProcesses: Map<string, DriverProcess> = new Map(); // New: DriverProcess for per-worker mode

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

    // Determine if using CrabNebula provider
    const firstCap = Array.isArray(capabilities) ? capabilities[0] : Object.values(capabilities)[0]?.capabilities;
    const mergedOptions = mergeOptions(this.options, firstCap?.['wdio:tauriServiceOptions']);
    const isCrabNebula = mergedOptions.driverProvider === 'crabnebula';

    // Check for unsupported platforms
    if (process.platform === 'darwin' && !isCrabNebula) {
      const errorMessage =
        'Tauri testing on macOS requires CrabNebula driver. ' +
        'Set driverProvider: "crabnebula" in your service options, or ' +
        'run tests on Windows or Linux. ' +
        'See: https://docs.crabnebula.dev/tauri/webdriver/';
      log.error(errorMessage);
      throw new Error(errorMessage);
    }

    // For CrabNebula on macOS, validate prerequisites
    if (process.platform === 'darwin' && isCrabNebula) {
      await this.validateCrabNebulaPrerequisites(mergedOptions);
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

      // Ensure Edge WebDriver compatibility on Windows
      // This checks if msedgedriver matches the WebView2 version in the Tauri binary and downloads if needed
      // Only runs on Windows; skipped on Linux/macOS
      const autoDownloadEdgeDriver = this.options.autoDownloadEdgeDriver ?? true; // Default to true
      if (process.platform === 'win32') {
        log.debug('Checking Edge WebDriver compatibility...');
        const edgeDriverResult = await ensureMsEdgeDriver(appBinaryPath, autoDownloadEdgeDriver);

        if (!edgeDriverResult.success) {
          const errorMsg = edgeDriverResult.error || 'Unknown error checking Edge WebDriver';
          log.error(`Edge WebDriver check failed: ${errorMsg}`);

          if (!autoDownloadEdgeDriver) {
            // Only throw if auto-download is disabled - let user fix manually
            throw new Error(
              `${errorMsg}\n` +
                `To auto-fix: set autoDownloadEdgeDriver: true in tauri service options.\n` +
                `Or manually download from: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/`,
            );
          } else {
            // Auto-download was enabled but still failed - log warning and continue
            log.warn(`${errorMsg} - continuing anyway, test may fail with version mismatch`);
          }
        } else if (edgeDriverResult.method === 'downloaded') {
          log.info(
            `✅ Downloaded msedgedriver ${edgeDriverResult.driverVersion} for WebView2 ${edgeDriverResult.edgeVersion}`,
          );
        } else if (edgeDriverResult.method === 'found') {
          log.info(`✅ Using existing msedgedriver ${edgeDriverResult.driverVersion}`);
        }
        break; // Only check once for the first capability
      }

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

    // Ensure tauri-driver is installed before any workers start.
    // This prevents a race condition where parallel workers all try to
    // cargo-install tauri-driver simultaneously, causing "Access is denied" errors on Windows.
    const driverResult = await ensureTauriDriver(mergedOptions);
    if (!driverResult.success) {
      throw new Error(driverResult.error || 'Failed to find or install tauri-driver');
    }
    log.info(`tauri-driver ready: ${driverResult.path} (${driverResult.method})`);

    // Auto-detect per-worker mode based on maxInstances
    // When maxInstances > 1, enable per-worker spawning for parallelism
    // When maxInstances === 1, use single shared driver for optimal performance
    const maxInstances = _config.maxInstances || 100; // WDIO default is 100
    const isMultiremote = !Array.isArray(capabilities);
    this.perWorkerMode = maxInstances > 1 && !isMultiremote;

    log.info(
      `Per-worker mode: ${this.perWorkerMode ? 'enabled' : 'disabled'} (maxInstances=${maxInstances}, multiremote=${isMultiremote})`,
    );

    // Multiremote: spawn a dedicated tauri-driver per instance on unique ports
    if (isMultiremote) {
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
        // Use the multiremote key as the instance ID (e.g., 'browserA', 'browserB')
        const instanceId = String(key);

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
      // Standard session: single shared tauri-driver or per-worker drivers
      if (this.perWorkerMode) {
        // Per-worker mode: drivers will be spawned in onWorkerStart()
        log.info('Per-worker mode enabled - drivers will be spawned per worker in onWorkerStart()');
      } else {
        // Single driver mode: spawn one shared driver
        log.info('Single driver mode - spawning shared tauri-driver');
        const hostname = '127.0.0.1';

        // Dynamically allocate ports to avoid conflicts (e.g. port 4444 occupied on Windows CI)
        const usedPorts = new Set<number>();
        const port = await getPort({
          port: this.options.tauriDriverPort || 4444,
          host: hostname,
        });
        usedPorts.add(port);
        const nativePort = await getPort({
          port: 4445,
          host: hostname,
          exclude: Array.from(usedPorts),
        });

        try {
          await this.startTauriDriver(port, nativePort, capsList);
          log.info(`Successfully started tauri-driver on ${hostname}:${port}`);
        } catch (error) {
          log.error(`Failed to start tauri-driver: ${error}`);
          throw error;
        }

        // Update the capabilities object with hostname and port so WDIO connects to tauri-driver
        // This is necessary for standalone mode where capabilities are passed directly to remote()
        for (const cap of capsList) {
          (cap as { port?: number; hostname?: string }).port = port;
          (cap as { port?: number; hostname?: string }).hostname = hostname;
          log.info(`Set tauri-driver connection on capabilities: ${hostname}:${port}`);
        }
      }
    }

    // Start test-runner-backend for CrabNebula on macOS
    if (process.platform === 'darwin' && isCrabNebula) {
      const manageBackend = mergedOptions.crabnebulaManageBackend ?? true;
      if (manageBackend) {
        const backendPort = mergedOptions.crabnebulaBackendPort ?? 3000;
        const { proc } = await startTestRunnerBackend(backendPort);
        await waitTestRunnerBackendReady(backendPort);

        this.testRunnerBackend = proc;

        // Set environment variable for tauri-driver
        process.env.REMOTE_WEBDRIVER_URL = `http://127.0.0.1:${backendPort}`;
        log.info(`CrabNebula backend ready on port ${backendPort}`);
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
          // Use the multiremote key as the instance ID
          instanceId = String(firstKey);
          log.debug(`Multiremote instance detected: ${String(firstKey)} (ID: ${instanceId})`);
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

    // Per-worker mode: spawn dedicated driver for this worker
    if (this.perWorkerMode && !instanceId) {
      log.info(`Per-worker mode: spawning tauri-driver for worker ${cid}`);

      // Allocate ports for this worker
      const { port, nativePort } = await this.allocateWorkerPorts(cid);

      // Generate isolated data directory
      const dataDir = generateDataDirectory(`worker-${cid}`);

      // Merge options (global + capability-specific)
      const workerOptions = mergeOptions(this.options, firstCap['wdio:tauriServiceOptions']);

      // Set up environment variables for data directory isolation
      const envVarName = process.platform === 'linux' ? 'XDG_DATA_HOME' : 'TAURI_DATA_DIR';
      process.env[envVarName] = dataDir;

      // Spawn tauri-driver for this worker
      await this.startTauriDriverForWorker(cid, port, nativePort, workerOptions);

      // Update capabilities with allocated port so WDIO connects to correct port
      // This is critical - the worker needs to know which port to connect to
      const hostname = '127.0.0.1';
      for (const cap of capsList) {
        (cap as { port?: number; hostname?: string }).port = port;
        (cap as { port?: number; hostname?: string }).hostname = hostname;
        log.debug(`Updated worker ${cid} capabilities: ${hostname}:${port}`);
      }
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

    // 7. Check tauri-driver availability (using global options for diagnostics)
    // Note: Full driver check with capability-specific options happens in onPrepare
    const driverOptions: TauriServiceOptions = {
      autoInstallTauriDriver: this.options.autoInstallTauriDriver,
    };
    const driverResult = await ensureTauriDriver(driverOptions);

    if (!driverResult.success) {
      const errorMsg = driverResult.error || 'Failed to find or install tauri-driver';
      log.error(errorMsg);
      throw new Error(errorMsg);
    }

    log.info(`Using tauri-driver: ${driverResult.path} (${driverResult.method})`);

    // 8. Check WebKitWebDriver availability (Linux only)
    if (process.platform === 'linux') {
      const webkitResult = await ensureWebKitWebDriver();
      if (webkitResult.success && webkitResult.path) {
        log.info(`✅ WebKitWebDriver found: ${webkitResult.path}`);
      } else {
        log.warn('⚠️  WebKitWebDriver not found - tests may fail');
        if (webkitResult.installInstructions) {
          log.warn(`   Install it with: ${webkitResult.installInstructions}`);
        }
      }
    }

    // 9. Check available disk space
    try {
      const df = execSync('df -h . 2>&1 || true', { encoding: 'utf8', timeout: 2000 });
      log.info(`Disk space:\n${df}`);
    } catch {
      // Ignore
    }

    log.info('✅ Diagnostics complete\n');
  }

  /**
   * Allocate ports for a worker
   */
  private async allocateWorkerPorts(workerId: string): Promise<{ port: number; nativePort: number }> {
    const basePort = this.options.tauriDriverPort || 4444;
    const baseNativePort = 4445;

    // Get list of already allocated ports to exclude
    const usedPorts = new Set<number>();
    for (const [, info] of this.perWorkerDrivers) {
      usedPorts.add(info.port);
      usedPorts.add(info.nativePort);
    }

    // Allocate main port (use basePort + number of existing workers as starting point)
    const preferredPort = basePort + this.perWorkerDrivers.size;
    const port = await getPort({
      port: preferredPort,
      host: '127.0.0.1',
      exclude: Array.from(usedPorts),
    });
    usedPorts.add(port);

    // Allocate native port
    const preferredNativePort = baseNativePort + this.perWorkerDrivers.size;
    const nativePort = await getPort({
      port: preferredNativePort,
      host: '127.0.0.1',
      exclude: Array.from(usedPorts),
    });

    log.info(`Allocated ports for worker ${workerId}: main=${port}, native=${nativePort}`);
    return { port, nativePort };
  }

  /**
   * Start tauri-driver for a specific worker
   */
  private async startTauriDriverForWorker(
    workerId: string,
    port: number,
    nativePort: number,
    options?: TauriServiceOptions,
  ): Promise<void> {
    const workerOptions = options ?? mergeOptions(this.options, undefined);
    const driverResult = await ensureTauriDriver(workerOptions);
    if (!driverResult.success) {
      throw new Error(driverResult.error || 'Failed to find tauri-driver');
    }

    const tauriDriverPath = driverResult.path;

    log.info(`Starting tauri-driver [worker-${workerId}] on port ${port} (native port: ${nativePort})`);

    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();
    if (nativeDriverPath) {
      log.debug(`[worker-${workerId}] Using native driver: ${nativeDriverPath}`);
    }

    // Create DriverProcess for this worker
    const driverProcess = new DriverProcess();
    this.perWorkerDriverProcesses.set(workerId, driverProcess);

    const info = await driverProcess.start({
      mode: 'worker',
      identifier: `worker-${workerId}`,
      port,
      nativePort,
      tauriDriverPath,
      nativeDriverPath,
      env: workerOptions.env,
      options: workerOptions,
    });

    // Keep backward compatibility with old map
    const dataDir = process.env.XDG_DATA_HOME || process.env.TAURI_DATA_DIR || '';
    this.perWorkerDrivers.set(workerId, { proc: info.proc, port, nativePort, dataDir });

    log.info(`[worker-${workerId}] Driver ready on port ${port} (native port: ${nativePort})`);
  }

  /**
   * End worker session
   */
  async onWorkerEnd(cid: string): Promise<void> {
    log.debug(`Ending Tauri worker session: ${cid}`);

    // Per-worker mode: clean up this worker's driver
    if (this.perWorkerMode) {
      await this.stopTauriDriverForWorker(cid);
    }
    // In single driver mode, cleanup is handled in onComplete
  }

  /**
   * Stop tauri-driver for a specific worker
   */
  private async stopTauriDriverForWorker(workerId: string): Promise<void> {
    const driverProcess = this.perWorkerDriverProcesses.get(workerId);
    if (!driverProcess) {
      log.debug(`No driver found for worker ${workerId}`);
      return;
    }

    log.info(`Stopping tauri-driver for worker ${workerId}`);
    await driverProcess.stop();
    this.perWorkerDriverProcesses.delete(workerId);
    this.perWorkerDrivers.delete(workerId);
    log.debug(`Driver for worker ${workerId} stopped and cleaned up`);
  }

  /**
   * Complete service lifecycle
   */
  async onComplete(_exitCode: number, _config: Options.Testrunner, _capabilities: TauriCapabilities[]): Promise<void> {
    log.debug('Completing Tauri service...');

    // Close log writer if initialized
    try {
      const { closeStandaloneLogWriter } = await import('./logWriter.js');
      closeStandaloneLogWriter();
    } catch {
      // Log writer may not have been initialized
    }

    // Stop test-runner-backend for CrabNebula
    if (this.testRunnerBackend) {
      await stopTestRunnerBackend(this.testRunnerBackend);
      this.testRunnerBackend = undefined;
    }

    // Stop tauri-driver
    await this.stopTauriDriver();

    log.debug('Tauri service completed');
  }

  /**
   * Start tauri-driver process
   */
  private async startTauriDriver(port: number, nativePort: number, capabilities?: TauriCapabilities[]): Promise<void> {
    // Get options for driver management
    const firstCap = capabilities?.[0];
    const options = mergeOptions(this.options, firstCap?.['wdio:tauriServiceOptions']);
    log.debug(`Single driver mode options: ${JSON.stringify(options, null, 2)}`);
    log.debug(
      `Single driver mode: captureFrontendLogs=${options.captureFrontendLogs}, captureBackendLogs=${options.captureBackendLogs}`,
    );

    // Ensure driver is available
    const driverResult = await ensureTauriDriver(options);
    if (!driverResult.success) {
      throw new Error(driverResult.error || 'Failed to find tauri-driver');
    }

    const tauriDriverPath = driverResult.path;

    log.debug(`Starting tauri-driver on port ${port} (native port: ${nativePort})`);

    // Resolve native driver path (WebKitWebDriver on Linux)
    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();

    if (nativeDriverPath) {
      log.debug(`Using native driver: ${nativeDriverPath}`);
    }

    // Use DriverProcess for single mode
    this.driverProcess = new DriverProcess();

    if (process.platform === 'linux') {
      log.info(`Starting tauri-driver (DISPLAY from environment: ${process.env.DISPLAY || 'not set'})`);
    }

    await this.driverProcess.start({
      mode: 'single',
      identifier: 'tauri-driver',
      port,
      nativePort,
      tauriDriverPath,
      nativeDriverPath,
      env: options.env,
      options,
    });

    log.info(`Driver ready on port ${port} (native port: ${nativePort})`);
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
    // Ensure driver is available
    const instanceOptions = options ?? mergeOptions(this.options, undefined);
    const driverResult = await ensureTauriDriver(instanceOptions);
    if (!driverResult.success) {
      throw new Error(driverResult.error || 'Failed to find tauri-driver');
    }

    const tauriDriverPath = driverResult.path;

    log.info(`Starting tauri-driver [${instanceId}] on port ${port} (native port: ${nativePort})`);
    const args = ['--port', port.toString(), '--native-port', nativePort.toString()];

    const nativeDriverPath = this.options.nativeDriverPath || getWebKitWebDriverPath();
    if (nativeDriverPath) {
      args.push('--native-driver', nativeDriverPath);
      log.debug(`[${instanceId}] Using native driver: ${nativeDriverPath}`);
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const safeResolve = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      const safeReject = (err: Error) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };

      const proc = spawn(tauriDriverPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        env,
      });

      log.info(`[${instanceId}] Spawned process with PID: ${proc.pid ?? 'unknown'}`);
      this.tauriDriverProcesses.set(instanceId, { proc, port, nativePort });

      const instanceOpts = options ?? mergeOptions(this.options, undefined);

      // Use readline for line-buffered log handling (fixes Windows chunking issues)
      setupStreamLogHandler({
        stream: proc.stdout,
        streamName: 'stdout',
        identifier: instanceId,
        options: instanceOpts,
        onStartupDetected: () => safeResolve(),
        onErrorDetected: (msg) => safeReject(new Error(msg)),
        instanceId,
      });

      setupStreamLogHandler({
        stream: proc.stderr,
        streamName: 'stderr',
        identifier: instanceId,
        options: instanceOpts,
        instanceId,
      });

      proc.on('error', (error: Error) => {
        log.error(`❌ Failed to start tauri-driver [${instanceId}]: ${error.message}`);
        safeReject(error);
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
          safeResolve();
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
    throw new Error(`Port ${host}:${port} did not open within ${timeoutMs}ms`);
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
    throw new Error(`HTTP endpoint at http://${host}:${port} did not become ready within ${timeoutMs}ms`);
  }

  /**
   * Validate CrabNebula prerequisites for macOS testing
   * Checks for CN_API_KEY and test-runner-backend availability
   */
  private async validateCrabNebulaPrerequisites(options: TauriServiceOptions): Promise<void> {
    log.info('Validating CrabNebula prerequisites for macOS...');

    // Check CN_API_KEY
    if (!process.env.CN_API_KEY) {
      throw new Error(
        'CN_API_KEY environment variable is required for CrabNebula macOS testing. ' +
          'Contact CrabNebula (https://crabnebula.dev) to obtain an API key. ' +
          'See: https://docs.crabnebula.dev/tauri/webdriver/',
      );
    }

    // Check for test-runner-backend if auto-management is enabled
    const manageBackend = options.crabnebulaManageBackend ?? true;
    if (manageBackend) {
      const backendPath = findTestRunnerBackend();
      if (!backendPath) {
        throw new Error(
          '@crabnebula/test-runner-backend not found. ' +
            'Install with: npm install -D @crabnebula/test-runner-backend',
        );
      }
      log.debug(`Found test-runner-backend at: ${backendPath}`);
    }

    log.info('✅ CrabNebula prerequisites validated');
  }

  /**
   * Stop tauri-driver process with proper cleanup
   */
  private async stopTauriDriver(): Promise<void> {
    // Stop per-worker drivers
    if (this.perWorkerDriverProcesses.size > 0) {
      log.info(`Stopping ${this.perWorkerDriverProcesses.size} per-worker driver(s)...`);
      for (const [workerId, driverProcess] of this.perWorkerDriverProcesses.entries()) {
        log.debug(`Stopping tauri-driver [worker-${workerId}]...`);
        await driverProcess.stop();
      }
      this.perWorkerDriverProcesses.clear();
      this.perWorkerDrivers.clear();
      return;
    }

    // Stop per-instance drivers if present (multiremote)
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

    // Single driver mode
    if (this.driverProcess) {
      await this.driverProcess.stop();
      this.driverProcess = undefined;
    }
  }

  /**
   * Get tauri-driver status
   */
  getTauriDriverStatus(): { running: boolean; pid?: number } {
    // Check single mode DriverProcess first
    if (this.driverProcess) {
      return {
        running: this.driverProcess.isRunning(),
        pid: this.driverProcess.proc?.pid,
      };
    }

    // Check per-worker DriverProcesses - return first running worker
    for (const [, driverProcess] of this.perWorkerDriverProcesses.entries()) {
      if (driverProcess.isRunning()) {
        return {
          running: true,
          pid: driverProcess.proc?.pid,
        };
      }
    }

    return {
      running: false,
    };
  }
}
