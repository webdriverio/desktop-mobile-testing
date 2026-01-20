import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { readWdioLogs } from './helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('Tauri Log Integration', () => {
  describe('Command Execution', () => {
    it('should capture backend logs via generate_test_logs command', async () => {
      // Generate backend logs - emits events that frontend forwards to console
      // Logs appear in real-time via WebDriver console capture
      await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));

      // Wait a moment for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Read captured logs
      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      expect(logs.length).toBeGreaterThan(0);

      // Verify [Tauri:Backend] prefix in logs (logs are forwarded via frontend console)
      const hasBackendPrefix = logs.includes('[Tauri:Backend]');
      expect(hasBackendPrefix).toBe(true);

      // Verify specific log entries
      const hasInfoLog = logs.includes('[Tauri:Backend] [Test] This is an INFO level log');
      const hasWarnLog = logs.includes('[Tauri:Backend] [Test] This is a WARN level log');
      const hasErrorLog = logs.includes('[Tauri:Backend] [Test] This is an ERROR level log');

      expect(hasInfoLog).toBe(true);
      expect(hasWarnLog).toBe(true);
      expect(hasErrorLog).toBe(true);
    });

    it('should have working Tauri API', async () => {
      const result = (await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'))) as { os: string };
      expect(result).toBeDefined();
      expect(result.os).toBeDefined();
    });

    it('should execute commands with parameters', async () => {
      const bounds = (await browser.tauri.execute(({ core }) => core.invoke('get_window_bounds'))) as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      expect(bounds).toBeDefined();
      expect(bounds.x).toBeDefined();
      expect(bounds.y).toBeDefined();
    });
  });

  describe('Console Log Capture', () => {
    it('should capture frontend console.log from browser.execute', async () => {
      // Execute console.log in the browser context via WebDriver
      await browser.execute(() => {
        console.info('[Tauri:Frontend] [Test] Frontend INFO from execute');
        console.warn('[Tauri:Frontend] [Test] Frontend WARN from execute');
        console.error('[Tauri:Frontend] [Test] Frontend ERROR from execute');
      });

      // Wait for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Read captured logs
      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      expect(logs.length).toBeGreaterThan(0);

      // Frontend logs from execute() are captured by WebDriver with [Tauri:Frontend] prefix
      const hasFrontendPrefix = logs.includes('[Tauri:Frontend]');
      expect(hasFrontendPrefix).toBe(true);

      const hasInfoLog = logs.includes('[Tauri:Frontend] [Test] Frontend INFO from execute');
      const hasWarnLog = logs.includes('[Tauri:Frontend] [Test] Frontend WARN from execute');
      const hasErrorLog = logs.includes('[Tauri:Frontend] [Test] Frontend ERROR from execute');

      expect(hasInfoLog).toBe(true);
      expect(hasWarnLog).toBe(true);
      expect(hasErrorLog).toBe(true);
    });

    it('should capture multiple log levels from browser.execute', async () => {
      await browser.execute(() => {
        console.trace('[Tauri:Frontend] [Test] TRACE from execute');
        console.debug('[Tauri:Frontend] [Test] DEBUG from execute');
        console.info('[Tauri:Frontend] [Test] INFO from execute');
        console.warn('[Tauri:Frontend] [Test] WARN from execute');
        console.error('[Tauri:Frontend] [Test] ERROR from execute');
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      expect(logs.length).toBeGreaterThan(0);

      // Verify [Tauri:Frontend] prefix and all log levels
      const hasFrontendPrefix = logs.includes('[Tauri:Frontend]');
      expect(hasFrontendPrefix).toBe(true);

      const hasTrace = logs.includes('[Tauri:Frontend] [Test] TRACE from execute');
      const hasDebug = logs.includes('[Tauri:Frontend] [Test] DEBUG from execute');
      const hasInfo = logs.includes('[Tauri:Frontend] [Test] INFO from execute');
      const hasWarn = logs.includes('[Tauri:Frontend] [Test] WARN from execute');
      const hasError = logs.includes('[Tauri:Frontend] [Test] ERROR from execute');

      expect(hasTrace).toBe(true);
      expect(hasDebug).toBe(true);
      expect(hasInfo).toBe(true);
      expect(hasWarn).toBe(true);
      expect(hasError).toBe(true);
    });

    it('should capture console.log with various message types', async () => {
      await browser.execute(() => {
        console.log('[Tauri:Frontend] [Test] String message');
        console.log('[Tauri:Frontend] [Test] Number:', 42);
        console.log('[Tauri:Frontend] [Test] Object:', { key: 'value' });
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      expect(logs.length).toBeGreaterThan(0);

      const hasStringLog = logs.includes('[Tauri:Frontend] [Test] String message');
      expect(hasStringLog).toBe(true);
    });
  });

  describe('Log Infrastructure', () => {
    it('should have log directory with log files', async () => {
      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
