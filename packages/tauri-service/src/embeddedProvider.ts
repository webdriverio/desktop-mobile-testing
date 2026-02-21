import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { createLogger } from '@wdio/native-utils';
import { forwardLog, type LogLevel } from './logForwarder.js';
import { parseLogLine } from './logParser.js';
import type { TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

interface StreamLogHandlerOptions {
  stream: Readable | null;
  streamName: string;
  identifier: string;
  options: TauriServiceOptions;
  instanceId?: string;
}

function setupStreamLogHandler(handlerOptions: StreamLogHandlerOptions): ReadlineInterface | undefined {
  const { stream, streamName, identifier, options, instanceId } = handlerOptions;

  if (!stream) {
    return undefined;
  }

  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  rl.on('line', (line: string) => {
    if (options.captureBackendLogs || options.captureFrontendLogs) {
      const parsedLog = parseLogLine(line);
      if (parsedLog) {
        if (options.captureBackendLogs && parsedLog.source !== 'frontend') {
          const minLevel = (options.backendLogLevel ?? 'info') as LogLevel;
          forwardLog('backend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
        }
        if (options.captureFrontendLogs && parsedLog.source === 'frontend') {
          const minLevel = (options.frontendLogLevel ?? 'info') as LogLevel;
          forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
        }
      }
    }
  });

  rl.on('error', (err) => {
    log.warn(`[${identifier}] ${streamName} stream error: ${err.message}`);
  });

  return rl;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the WebDriver status endpoint until ready or timeout
 */
async function pollWebDriverStatus(port: number, timeoutMs: number = 30000): Promise<void> {
  const startTime = Date.now();
  const statusUrl = `http://127.0.0.1:${port}/status`;

  log.info(`Polling WebDriver status at ${statusUrl}...`);

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(statusUrl, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const data = (await response.json()) as { value?: { ready?: boolean } };
        // W3C WebDriver status response: { value: { ready: boolean } }
        if (data?.value?.ready === true) {
          log.info(`✅ WebDriver server ready on port ${port}`);
          return;
        }
        log.debug(`WebDriver server not ready yet: ${JSON.stringify(data)}`);
      }
    } catch {
      // Connection refused or timeout - server not ready yet
      log.debug(`WebDriver status poll failed, retrying...`);
    }

    await sleep(500);
  }

  throw new Error(`WebDriver server did not become ready within ${timeoutMs}ms on port ${port}`);
}

/**
 * Spawn the Tauri app directly (no external driver)
 */
function spawnTauriApp(appBinaryPath: string, args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  log.info(`Spawning Tauri app: ${appBinaryPath} ${args.join(' ')}`);
  log.debug(`Environment: ${JSON.stringify(env, null, 2)}`);

  const child = spawn(appBinaryPath, args, {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  log.info(`Tauri app spawned (PID: ${child.pid})`);

  return child;
}

export interface EmbeddedDriverInfo {
  proc: ChildProcess;
  logHandlers: ReadlineInterface[];
}

/**
 * Start the embedded WebDriver provider
 * Spawns the Tauri app directly and polls for the embedded WebDriver server
 */
export async function startEmbeddedDriver(
  appBinaryPath: string,
  port: number,
  options: TauriServiceOptions,
  instanceId?: string,
): Promise<EmbeddedDriverInfo> {
  const appArgs = options.appArgs || [];

  // Set TAURI_WEBDRIVER_PORT env var to configure the embedded server port
  const env = {
    ...process.env,
    ...options.env,
    TAURI_WEBDRIVER_PORT: String(port),
  };

  // Spawn the app directly
  const child = spawnTauriApp(appBinaryPath, appArgs, env);

  // Set up log handlers for stdout/stderr
  const logHandlers: ReadlineInterface[] = [];
  const identifier = `embedded-${port}`;

  const stdoutHandler = setupStreamLogHandler({
    stream: child.stdout,
    streamName: 'stdout',
    identifier,
    options,
    instanceId,
  });
  if (stdoutHandler) logHandlers.push(stdoutHandler);

  const stderrHandler = setupStreamLogHandler({
    stream: child.stderr,
    streamName: 'stderr',
    identifier,
    options,
    instanceId,
  });
  if (stderrHandler) logHandlers.push(stderrHandler);

  // Wait for the embedded WebDriver server to be ready
  const startTimeout = options.startTimeout || 30000;
  try {
    await pollWebDriverStatus(port, startTimeout);
  } catch (error) {
    // Clean up the process and handlers if startup fails
    for (const handler of logHandlers) {
      handler.close();
    }
    child.kill('SIGTERM');
    throw error;
  }

  return { proc: child, logHandlers };
}

/**
 * Stop the embedded driver (kill the app process and close log handlers)
 */
export async function stopEmbeddedDriver(info: EmbeddedDriverInfo): Promise<void> {
  const { proc: child, logHandlers } = info;

  // Close log handlers first
  for (const handler of logHandlers) {
    try {
      handler.close();
    } catch {
      // Ignore errors on close
    }
  }

  if (!child.pid) {
    log.debug('No PID available for embedded driver');
    return;
  }

  log.info(`Stopping embedded driver (PID: ${child.pid})...`);

  // Try graceful shutdown first (SIGTERM)
  child.kill('SIGTERM');

  // Wait for process to exit
  const gracefulTimeout = 5000;
  const startTime = Date.now();

  while (Date.now() - startTime < gracefulTimeout) {
    if (child.exitCode !== null || child.signalCode !== null) {
      log.info(`✅ Embedded driver exited gracefully`);
      return;
    }
    await sleep(100);
  }

  // Force kill if still running
  log.warn('Embedded driver did not exit gracefully, forcing kill...');
  child.kill('SIGKILL');
}

/**
 * Check if embedded provider should be used
 */
export function isEmbeddedProvider(options: TauriServiceOptions): boolean {
  return options.driverProvider === 'embedded';
}

/**
 * Get the embedded port from options or env var
 * Defaults to 4445
 */
export function getEmbeddedPort(options: TauriServiceOptions): number {
  // Priority: 1. embeddedPort option, 2. TAURI_WEBDRIVER_PORT env var, 3. default 4445
  if (options.embeddedPort) {
    return options.embeddedPort;
  }
  const envPort = process.env.TAURI_WEBDRIVER_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!Number.isNaN(port)) {
      return port;
    }
  }
  return 4445;
}
