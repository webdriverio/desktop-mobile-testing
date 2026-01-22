import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Execute a command with environment variables and capture output
 */
export async function execWithEnv(
  command: string,
  env: Record<string, string> = {},
  options: { cwd?: string; timeout?: number } = {},
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const { cwd = process.cwd(), timeout = 120000 } = options;
    // Split command into parts for spawn
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    // Merge environment variables
    const mergedEnv = { ...process.env, ...env };

    const childProcess = spawn(cmd, args, {
      env: mergedEnv,
      cwd,
      shell: true,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let timeoutId: NodeJS.Timeout | null = null;

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
      }, timeout);
    }

    // Capture stdout and stream to console
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    // Capture stderr and stream to console
    childProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    // Handle process completion
    childProcess.on('close', (code) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve({ stdout, stderr, code: code || 0 });
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(error);
    });
  });
}

/**
 * Execute WDIO command with retry logic for xvfb failures on Linux
 */
export async function execWdio(
  command: string,
  env: Record<string, string> = {},
  options: { cwd?: string; timeout?: number } = {},
  maxRetries: number = 3,
): Promise<{ stdout: string; stderr: string; code: number }> {
  let lastError: { stdout: string; stderr: string; code: number } | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt === 1) {
        console.log(`🚀 Running WDIO command: ${command}`);
      } else {
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries}: ${command}`);
      }

      const result = await execWithEnv(command, env, options);

      // Check for xvfb failure on Linux
      if (
        result.code !== 0 &&
        process.platform === 'linux' &&
        (result.stderr.includes('Xvfb failed to start') ||
          result.stderr.includes('Cannot establish any listening sockets'))
      ) {
        console.log(`❌ Attempt ${attempt}/${maxRetries} failed with xvfb error`);
        console.log(`🔍 Error: ${result.stderr}`);

        if (attempt < maxRetries) {
          const delay = attempt * 1000; // Progressive delay: 1s, 2s, 3s
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          lastError = result;
          continue;
        }
      }

      // Success or non-xvfb error
      if (result.code === 0) {
        if (attempt > 1) {
          console.log(`✅ Success on attempt ${attempt}/${maxRetries}`);
        }
        return result;
      } else {
        // Non-xvfb error, don't retry
        return result;
      }
    } catch (error) {
      console.log(`❌ Attempt ${attempt}/${maxRetries} failed with error: ${error}`);

      if (attempt < maxRetries) {
        const delay = attempt * 1000;
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  // All retries exhausted
  console.log(`❌ All ${maxRetries} attempts failed`);
  return lastError || { stdout: '', stderr: 'All retries exhausted', code: 1 };
}

/**
 * Check if a file exists and is readable
 */
export function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export function dirExists(dirPath: string): boolean {
  try {
    const stat = fs.statSync(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

/**
 * Create a delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    backoff?: number;
  } = {},
): Promise<T> {
  const { retries = 3, delay: initialDelay = 1000, backoff = 2 } = options;

  let lastError: Error | undefined;

  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (i === retries) {
        break; // Don't delay on the last attempt
      }

      const delayMs = initialDelay * backoff ** i;
      await delay(delayMs);
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No error occurred');
}

/**
 * Safe JSON parsing with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Read WDIO log files from output directory
 */
export function readWdioLogs(logBaseDir: string): string {
  if (!fs.existsSync(logBaseDir)) {
    console.log(`[DEBUG] Log base directory does not exist: ${logBaseDir}`);
    return '';
  }

  // Check if there are .log files directly in the base directory (standalone mode)
  const directLogFiles = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.log'))
    .map((dirent) => dirent.name)
    .sort();

  if (directLogFiles.length > 0) {
    // Standalone mode: read log files directly from base directory
    console.log(`[DEBUG] Reading logs directly from: ${logBaseDir}`);
    console.log(`[DEBUG] Found log files: ${directLogFiles.join(', ')}`);

    let allLogs = '';
    for (const logFile of directLogFiles) {
      const logPath = path.join(logBaseDir, logFile);
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        allLogs += `${content}\n`;
        console.log(`[DEBUG] Read ${logFile}: ${content.length} chars`);
      } catch (error) {
        console.log(`[DEBUG] Failed to read ${logFile}: ${error}`);
      }
    }
    return allLogs;
  }

  // WDIO test runner mode: find the most recent log directory
  const logDirs = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
    .reverse();

  if (logDirs.length === 0) {
    console.log(`[DEBUG] No log directories or files found in: ${logBaseDir}`);
    return '';
  }

  console.log(`[DEBUG] Found log directories: ${logDirs.join(', ')}`);

  // Read all log files from the most recent directory
  const logDir = path.join(logBaseDir, logDirs[0]);
  const logFiles = fs
    .readdirSync(logDir)
    .filter((file) => file.endsWith('.log'))
    .sort();

  console.log(`[DEBUG] Reading logs from: ${logDir}`);
  console.log(`[DEBUG] Found log files: ${logFiles.join(', ')}`);

  let allLogs = '';
  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      allLogs += `${content}\n`;
      console.log(`[DEBUG] Read ${logFile}: ${content.length} chars`);
    } catch (error) {
      console.log(`[DEBUG] Failed to read ${logFile}: ${error}`);
    }
  }

  return allLogs;
}

/**
 * Find log entries matching a pattern
 */
export function findLogEntries(logs: string, pattern: string | RegExp): string[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return logs.split('\n').filter((line) => regex.test(line));
}

/**
 * Assert log contains expected message
 */
export function assertLogContains(logs: string, expected: string | RegExp): void {
  const found = typeof expected === 'string' ? logs.includes(expected) : expected.test(logs);

  if (!found) {
    throw new Error(`Expected log message not found: ${expected}\n\nLogs:\n${logs.slice(0, 1000)}`);
  }
}

/**
 * Assert log does NOT contain a pattern (for testing filtering)
 */
export function assertLogDoesNotContain(logs: string, pattern: string | RegExp): void {
  const found = typeof pattern === 'string' ? logs.includes(pattern) : pattern.test(logs);

  if (found) {
    const matches = findLogEntries(logs, pattern);
    throw new Error(
      `Expected log pattern to be filtered out: ${pattern}\n\nFound ${matches.length} matches:\n${matches.slice(0, 5).join('\n')}`,
    );
  }
}

/**
 * Wait for a log message to appear in the log directory
 * Uses polling to check for the expected pattern
 */
export async function waitForLog(
  logDir: string,
  pattern: string | RegExp,
  timeout: number = 10000,
  interval: number = 500,
  settleDelay: number = 2000,
): Promise<boolean> {
  const startTime = Date.now();
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

  while (Date.now() - startTime < timeout) {
    const logs = readWdioLogs(logDir);
    if (regex.test(logs)) {
      // Pattern matched - wait for additional logs to be written/flushed
      await new Promise((resolve) => setTimeout(resolve, settleDelay));
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Compute the E2E app directory name based on framework, app type, and binary mode.
 * This is used consistently across envSchema, build scripts, and test runners.
 *
 * @param framework - 'electron' or 'tauri'
 * @param app - App type: 'builder', 'forge', 'script', or 'basic' (for Tauri)
 * @param isScript - Whether this is a script mode (only used for Electron)
 * @returns The computed directory name
 */
export function getE2EAppDirName(
  framework: 'electron' | 'tauri',
  app: 'builder' | 'forge' | 'script' | 'basic',
  isScript: boolean,
): string {
  if (framework === 'tauri') {
    // Tauri app directory is always 'tauri' regardless of app type
    return 'tauri';
  }

  if (isScript) {
    return 'electron-script';
  }

  return `electron-${app}`;
}
