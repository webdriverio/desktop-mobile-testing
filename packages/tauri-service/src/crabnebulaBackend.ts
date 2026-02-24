import { type ChildProcess, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createLogger } from '@wdio/native-utils';
import { findTestRunnerBackend } from './driverManager.js';

const log = createLogger('tauri-service');

export interface BackendProcessInfo {
  proc: ChildProcess;
  port: number;
}

/**
 * Start the CrabNebula test-runner-backend process
 * Required for macOS testing with CrabNebula driver
 *
 * @param port - Port for the backend to listen on (default: 3000)
 * @returns Process info including the ChildProcess and port
 * @throws Error if CN_API_KEY is not set or backend fails to start
 */
export async function startTestRunnerBackend(port: number = 3000): Promise<BackendProcessInfo> {
  const backendPath = findTestRunnerBackend();

  if (!backendPath) {
    throw new Error('test-runner-backend not found. Install with: npm install -D @crabnebula/test-runner-backend');
  }

  log.info(`Found test-runner-backend at: ${backendPath}`);

  // Validate CN_API_KEY
  if (!process.env.CN_API_KEY) {
    throw new Error(
      'CN_API_KEY environment variable is required for CrabNebula macOS testing. ' +
        'Contact CrabNebula (https://crabnebula.dev) to obtain an API key.',
    );
  }

  const apiKey = process.env.CN_API_KEY;
  if (apiKey.trim() === '') {
    throw new Error(
      'CN_API_KEY environment variable is set but empty. ' + 'Please provide a valid CrabNebula API key.',
    );
  }

  // Log API key with redaction (show first 4 and last 4 chars)
  const redactedKey =
    apiKey.length > 12
      ? `${apiKey.slice(0, 4)}${'*'.repeat(Math.min(apiKey.length - 8, 20))}${apiKey.slice(-4)}`
      : `${apiKey.slice(0, 2)}${'*'.repeat(apiKey.length - 4)}${apiKey.slice(-2)}`;
  log.info(`CN_API_KEY detected: ${redactedKey} (${apiKey.length} chars)`);

  log.info(`Starting test-runner-backend on port ${port}`);

  return new Promise((resolve, reject) => {
    const proc = spawn(backendPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    });

    let isReady = false;
    let startupTimeout: NodeJS.Timeout;
    let stdoutRl: ReturnType<typeof createInterface> | undefined;
    let stderrRl: ReturnType<typeof createInterface> | undefined;

    const cleanup = () => {
      clearTimeout(startupTimeout);
      if (stdoutRl) {
        stdoutRl.close();
        stdoutRl = undefined;
      }
      if (stderrRl) {
        stderrRl.close();
        stderrRl = undefined;
      }
    };

    // Handle stdout for ready detection
    if (proc.stdout) {
      stdoutRl = createInterface({ input: proc.stdout });
      stdoutRl.on('line', (line: string) => {
        log.debug(`[test-runner-backend] ${line}`);

        // Detect ready state - adjust based on actual backend output
        if (line.includes('listening') || line.includes('ready') || line.includes('started')) {
          if (!isReady) {
            isReady = true;
            cleanup();
            resolve({ proc, port });
          }
        }
      });
    }

    // Handle stderr
    if (proc.stderr) {
      stderrRl = createInterface({ input: proc.stderr });
      stderrRl.on('line', (line: string) => {
        log.error(`[test-runner-backend stderr] ${line}`);
      });
    }

    // Also log stdout at info level for debugging
    if (proc.stdout) {
      proc.stdout.on('data', (data: Buffer) => {
        log.info(`[test-runner-backend stdout] ${data.toString().trim()}`);
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        log.error(`[test-runner-backend stderr] ${data.toString().trim()}`);
      });
    }

    proc.on('error', (error: Error) => {
      if (!isReady) {
        cleanup();
        reject(new Error(`Failed to start test-runner-backend: ${error.message}`));
      }
    });

    proc.on('exit', (code: number | null) => {
      if (!isReady && code !== 0) {
        cleanup();
        reject(
          new Error(
            `test-runner-backend exited with code ${code}. ` +
              'Ensure CN_API_KEY is valid and the service is accessible.',
          ),
        );
      }
    });

    // Timeout fallback - assume ready after timeout even if no message detected
    startupTimeout = setTimeout(() => {
      if (!isReady) {
        log.warn('test-runner-backend startup timeout, assuming ready');
        isReady = true;
        cleanup();
        resolve({ proc, port });
      }
    }, 10000);
  });
}

/**
 * Wait for test-runner-backend HTTP endpoint to be ready
 * Polls the health endpoint until it responds
 *
 * @param port - Port the backend is listening on
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @throws Error if backend doesn't become ready within timeout
 */
export async function waitTestRunnerBackendReady(port: number = 3000, timeoutMs: number = 30000): Promise<void> {
  const http = await import('node:http');
  const started = Date.now();

  log.debug(`Waiting for test-runner-backend on port ${port}...`);

  while (Date.now() - started < timeoutMs) {
    const isReady = await new Promise<boolean>((resolve) => {
      // Try /health first, fallback to root
      const tryEndpoint = (path: string) => {
        const req = http.get(`http://127.0.0.1:${port}${path}`, { timeout: 1000 }, (res) => {
          // Any successful response means the server is up
          res.once('data', () => {});
          res.once('end', () => resolve(res.statusCode === 200));
        });
        req.on('error', () => {
          if (path === '/health') {
            tryEndpoint('/');
          } else {
            resolve(false);
          }
        });
        req.on('timeout', () => {
          req.destroy();
          if (path === '/health') {
            tryEndpoint('/');
          } else {
            resolve(false);
          }
        });
      };
      tryEndpoint('/health');
    });

    if (isReady) {
      log.debug(`test-runner-backend ready on port ${port}`);
      return;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  throw new Error(`test-runner-backend did not become ready within ${timeoutMs}ms`);
}

/**
 * Stop the test-runner-backend process
 * Sends SIGTERM first, then SIGKILL if process doesn't exit gracefully
 *
 * @param proc - The ChildProcess to stop
 * @returns Promise that resolves when process has exited
 */
export async function stopTestRunnerBackend(proc: ChildProcess): Promise<void> {
  if (proc.killed) {
    log.debug('test-runner-backend already stopped');
    return;
  }

  log.info('Stopping test-runner-backend');

  // Send SIGTERM for graceful shutdown
  proc.kill('SIGTERM');

  // Wait for graceful shutdown with timeout
  await new Promise<void>((resolve) => {
    const killTimeout = setTimeout(() => {
      if (!proc.killed) {
        log.warn('test-runner-backend did not exit gracefully, forcing kill');
        proc.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(killTimeout);
      resolve();
    });
  });

  log.debug('test-runner-backend stopped');
}

/**
 * Check if test-runner-backend is healthy
 * Useful for health checks during test execution
 *
 * @param port - Port the backend is listening on
 * @returns true if backend is responding to health checks
 */
export async function isTestRunnerBackendHealthy(port: number = 3000): Promise<boolean> {
  const http = await import('node:http');

  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, { timeout: 2000 }, (res) => {
      res.once('data', () => {});
      res.once('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}
