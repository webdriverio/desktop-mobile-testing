import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

/**
 * Read WDIO log files from output directory
 */
function readWdioLogs(): string {
  // WDIO outputDir is typically set in wdio config
  // For tests, logs are in e2e/logs/{testType}-{appDirName}/
  const logBaseDir = path.join(__dirname, '..', '..', 'logs');
  if (!fs.existsSync(logBaseDir)) {
    console.log(`[DEBUG] Log base directory does not exist: ${logBaseDir}`);
    return '';
  }

  // Find the most recent log directory (or any log directory)
  const logDirs = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
    .reverse();

  if (logDirs.length === 0) {
    console.log(`[DEBUG] No log directories found in: ${logBaseDir}`);
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
      allLogs += content + '\n';
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
function findLogEntries(logs: string, pattern: string | RegExp): string[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return logs.split('\n').filter((line) => regex.test(line));
}

/**
 * Assert log contains expected message
 */
function assertLogContains(logs: string, expected: string | RegExp): void {
  const found = typeof expected === 'string' ? logs.includes(expected) : expected.test(logs);

  if (!found) {
    throw new Error(`Expected log message not found: ${expected}\n\nLogs:\n${logs.slice(0, 1000)}`);
  }
}

describe('Tauri Log Integration', () => {
  describe('Backend Log Capture', () => {
    it('should capture backend logs when enabled', async () => {
      // Generate logs via test command
      await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));

      // Wait longer for logs to be captured and written to disk
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const logs = readWdioLogs();
      console.log(`[DEBUG] Total log length: ${logs.length}`);
      console.log(`[DEBUG] Sample logs (first 2000 chars): ${logs.slice(0, 2000)}`);

      if (!logs) {
        throw new Error('No logs found in output directory');
      }

      assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*INFO level log/i);
      assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*WARN level log/i);
      assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*ERROR level log/i);
    });

    it('should filter backend logs by level', async () => {
      // Generate logs via test command
      await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));

      // Wait a bit for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logs = readWdioLogs();
      // With default 'info' level, should not see trace/debug
      const traceLogs = findLogEntries(logs, /\[Tauri:Backend\].*TRACE/i);
      const debugLogs = findLogEntries(logs, /\[Tauri:Backend\].*DEBUG/i);

      // Trace and debug should be filtered out at 'info' level
      expect(traceLogs.length).toBe(0);
      expect(debugLogs.length).toBe(0);
    });
  });

  describe('Frontend Log Capture', () => {
    it('should capture frontend console logs when enabled', async () => {
      console.log('[DEBUG] About to trigger frontend console logs');

      // First, check if attachConsole was called
      const initStatus = await browser.execute(() => {
        return {
          // @ts-expect-error - checking internal state
          wdioTauriAvailable: typeof window.wdioTauri !== 'undefined',
          // @ts-expect-error
          tauriAvailable: typeof window.__TAURI__ !== 'undefined',
          // @ts-expect-error
          tauriLogAvailable: typeof window.__TAURI__?.log !== 'undefined',
        };
      });
      console.log('[DEBUG] Init status:', JSON.stringify(initStatus));

      // Trigger frontend logs by executing a script
      // Console forwarding is auto-injected by the Tauri service
      console.log('[DEBUG] Executing console.info/warn/error...');
      await browser.execute(() => {
        console.info('[Test] Frontend INFO log from test');
        console.warn('[Test] Frontend WARN log from test');
        console.error('[Test] Frontend ERROR log from test');
      });
      console.log('[DEBUG] Console logs executed');

      // Wait longer for logs to be captured and written to disk
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const logs = readWdioLogs();
      console.log(`[DEBUG] Total log length: ${logs.length}`);

      // Search for frontend logs - they should have [Tauri:Frontend] prefix
      // and contain the test message
      const frontendLogs = findLogEntries(logs, /\[Tauri:Frontend\]/);
      console.log(`[DEBUG] Found ${frontendLogs.length} frontend log entries`);
      if (frontendLogs.length > 0) {
        console.log(`[DEBUG] Sample frontend logs: ${frontendLogs.slice(0, 5).join('\n')}`);
      }

      if (!logs) {
        throw new Error('No logs found in output directory');
      }

      // Check for frontend logs - they should be identified and forwarded
      // Note: If attachConsole() isn't working, these logs won't appear
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Frontend.*INFO/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Frontend.*WARN/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Frontend.*ERROR/i);
    });

    it('should filter frontend logs by level', async () => {
      // Trigger frontend logs - console forwarding is auto-injected
      await browser.execute(() => {
        console.debug('[Test] Frontend DEBUG log');
        console.info('[Test] Frontend INFO log');
      });

      // Wait a bit for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logs = readWdioLogs();
      // With default 'info' level, debug should be filtered out
      const debugLogs = findLogEntries(logs, /\[Tauri:Frontend\].*DEBUG/i);
      expect(debugLogs.length).toBe(0);
    });
  });

  describe('Combined Log Capture', () => {
    it('should capture both backend and frontend logs when both enabled', async () => {
      // Generate both backend and frontend logs
      await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
      await browser.execute(() => {
        console.info('[Test] Combined test - frontend log');
      });

      // Wait longer for logs to be captured and written to disk
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const logs = readWdioLogs();
      console.log(`[DEBUG] Total log length: ${logs.length}`);
      console.log(`[DEBUG] Sample logs (first 2000 chars): ${logs.slice(0, 2000)}`);

      if (!logs) {
        throw new Error('No logs found in output directory');
      }

      assertLogContains(logs, /\[Tauri:Backend\].*\[Test\]/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\]/i);
    });
  });
});
