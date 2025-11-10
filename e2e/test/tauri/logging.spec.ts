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
    return '';
  }

  // Read all log files from the most recent directory
  const logDir = path.join(logBaseDir, logDirs[0]);
  const logFiles = fs
    .readdirSync(logDir)
    .filter((file) => file.endsWith('.log'))
    .sort();

  let allLogs = '';
  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      allLogs += content + '\n';
    } catch {
      // Ignore read errors
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

      // Wait a bit for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logs = readWdioLogs();
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
      // Trigger frontend logs by executing a script
      await browser.execute(() => {
        console.info('[Test] Frontend INFO log from test');
        console.warn('[Test] Frontend WARN log from test');
        console.error('[Test] Frontend ERROR log from test');
      });

      // Wait a bit for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logs = readWdioLogs();
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*INFO log/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*WARN log/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*ERROR log/i);
    });

    it('should filter frontend logs by level', async () => {
      // Trigger frontend logs
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

      // Wait a bit for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logs = readWdioLogs();
      assertLogContains(logs, /\[Tauri:Backend\].*\[Test\]/i);
      assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\]/i);
    });
  });
});
