import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { assertLogContains, findLogEntries, readWdioLogs } from './helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('Electron Log Integration', () => {
  describe('Main Process Log Capture', () => {
    it('should capture main process logs when enabled', async () => {
      // Trigger main process logs via electron.execute
      await browser.electron.execute(() => {
        console.info('[Test] Main process INFO log');
        console.warn('[Test] Main process WARN log');
        console.error('[Test] Main process ERROR log');
      });

      // Wait for logs to be captured and written to disk
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      console.log(`[DEBUG] Total log length: ${logs.length}`);
      console.log(`[DEBUG] Sample logs (first 2000 chars): ${logs.slice(0, 2000)}`);

      if (!logs) {
        throw new Error('No logs found in output directory');
      }

      // Check for main process logs with [Electron:MainProcess] prefix
      assertLogContains(logs, /\[Electron:MainProcess\].*\[Test\].*INFO/i);
      assertLogContains(logs, /\[Electron:MainProcess\].*\[Test\].*WARN/i);
      assertLogContains(logs, /\[Electron:MainProcess\].*\[Test\].*ERROR/i);
    });

    it('should filter main process logs by level', async () => {
      // Trigger main process logs
      await browser.electron.execute(() => {
        console.debug('[Test] Main process DEBUG log');
        console.info('[Test] Main process INFO log for filtering test');
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);

      // With default 'info' level, DEBUG should be filtered out
      const debugLogs = findLogEntries(logs, /\[Electron:MainProcess\].*DEBUG/i);
      expect(debugLogs.length).toBe(0);
    });
  });

  describe('Renderer Process Log Capture', () => {
    it('should capture renderer console logs when enabled', async () => {
      // Trigger renderer logs via browser.execute
      await browser.execute(() => {
        console.info('[Test] Renderer INFO log');
        console.warn('[Test] Renderer WARN log');
        console.error('[Test] Renderer ERROR log');
      });

      // Wait for logs to be captured and written to disk
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);
      console.log(`[DEBUG] Total log length: ${logs.length}`);

      // Search for renderer logs
      const rendererLogs = findLogEntries(logs, /\[Electron:Renderer\]/);
      console.log(`[DEBUG] Found ${rendererLogs.length} renderer log entries`);
      if (rendererLogs.length > 0) {
        console.log(`[DEBUG] Sample renderer logs: ${rendererLogs.slice(0, 5).join('\n')}`);
      }

      if (!logs) {
        throw new Error('No logs found in output directory');
      }

      // Check for renderer logs with [Electron:Renderer] prefix
      assertLogContains(logs, /\[Electron:Renderer\].*\[Test\].*INFO/i);
      assertLogContains(logs, /\[Electron:Renderer\].*\[Test\].*WARN/i);
      assertLogContains(logs, /\[Electron:Renderer\].*\[Test\].*ERROR/i);
    });

    it('should filter renderer logs by level', async () => {
      // Trigger renderer logs
      await browser.execute(() => {
        console.debug('[Test] Renderer DEBUG log');
        console.info('[Test] Renderer INFO log for filtering test');
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);

      // With default 'info' level, DEBUG should be filtered out
      const debugLogs = findLogEntries(logs, /\[Electron:Renderer\].*DEBUG/i);
      expect(debugLogs.length).toBe(0);
    });
  });

  describe('Combined Log Capture', () => {
    it('should capture both main and renderer logs simultaneously', async () => {
      // Trigger main process log
      await browser.electron.execute(() => {
        console.info('[Test] Combined main process log');
      });

      // Trigger renderer log
      await browser.execute(() => {
        console.info('[Test] Combined renderer log');
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const logBaseDir = path.join(__dirname, '..', '..', 'logs');
      const logs = readWdioLogs(logBaseDir);

      // Both should be present
      assertLogContains(logs, /\[Electron:MainProcess\].*Combined main process/i);
      assertLogContains(logs, /\[Electron:Renderer\].*Combined renderer/i);
    });
  });
});
