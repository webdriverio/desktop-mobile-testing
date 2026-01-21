import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { readWdioLogs } from './helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function getLogDir() {
  return path.join(__dirname, '..', '..', 'logs');
}

describe('Tauri Log Integration', () => {
  describe('Command Execution', () => {
    it('should capture backend logs via generate_test_logs command', async () => {
      await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));

      await browser.waitUntil(
        async () => {
          const logs = readWdioLogs(getLogDir());
          return logs.includes('[Tauri:Backend]');
        },
        { timeout: 5000, timeoutMsg: 'Backend logs not captured' },
      );

      const logs = readWdioLogs(getLogDir());
      expect(logs).toMatch(/\[Tauri:Backend\].*INFO level log/s);
      expect(logs).toMatch(/\[Tauri:Backend\].*WARN level log/s);
      expect(logs).toMatch(/\[Tauri:Backend\].*ERROR level log/s);
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
      await browser.execute(() => {
        console.info('Frontend INFO from execute');
        console.warn('Frontend WARN from execute');
        console.error('Frontend ERROR from execute');
      });

      await browser.waitUntil(
        async () => {
          const logs = readWdioLogs(getLogDir());
          return logs.includes('[Tauri:Frontend]');
        },
        { timeout: 5000, timeoutMsg: 'Frontend logs not captured' },
      );

      const logs = readWdioLogs(getLogDir());
      expect(logs).toMatch(/\[Tauri:Frontend\].*Frontend INFO from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*Frontend WARN from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*Frontend ERROR from execute/s);
    });

    it('should capture multiple log levels from browser.execute', async () => {
      await browser.execute(() => {
        console.trace('TRACE from execute');
        console.debug('DEBUG from execute');
        console.info('INFO from execute');
        console.warn('WARN from execute');
        console.error('ERROR from execute');
      });

      await browser.waitUntil(
        async () => {
          const logs = readWdioLogs(getLogDir());
          return logs.includes('[Tauri:Frontend]');
        },
        { timeout: 5000, timeoutMsg: 'Frontend logs not captured' },
      );

      const logs = readWdioLogs(getLogDir());
      expect(logs).toMatch(/\[Tauri:Frontend\].*TRACE from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*DEBUG from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*INFO from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*WARN from execute/s);
      expect(logs).toMatch(/\[Tauri:Frontend\].*ERROR from execute/s);
    });

    it('should capture console.log with various message types', async () => {
      await browser.execute(() => {
        console.log('String message');
        console.log('Number:', 42);
        console.log('Object:', { key: 'value' });
      });

      await browser.waitUntil(
        async () => {
          const logs = readWdioLogs(getLogDir());
          return logs.includes('[Tauri:Frontend]');
        },
        { timeout: 5000, timeoutMsg: 'Frontend logs not captured' },
      );

      const logs = readWdioLogs(getLogDir());
      expect(logs).toMatch(/\[Tauri:Frontend\].*String message/s);
    });
  });

  describe('Log Infrastructure', () => {
    it('should have log directory with log files', async () => {
      const logs = readWdioLogs(getLogDir());
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Console Wrapping (Issue #3 Fix)', () => {
    it('should handle nested browser.execute calls without infinite loops', async () => {
      // This test verifies that the console wrapping fix prevents infinite loops
      // when browser.execute is called multiple times
      const results: number[] = [];

      await browser.execute((input: number) => {
        results.push(input);
        console.log(`Nested execute level ${input}`);
        return input;
      }, 1);

      await browser.execute((input: number) => {
        results.push(input);
        console.log(`Nested execute level ${input}`);
        return input;
      }, 2);

      await browser.execute((input: number) => {
        results.push(input);
        console.log(`Nested execute level ${input}`);
        return input;
      }, 3);

      // Verify all nested calls completed without hanging
      expect(results).toEqual([1, 2, 3]);
    });

    it('should not double-wrap console methods on multiple execute calls', async () => {
      // Run multiple execute calls and verify logs are captured correctly
      // without excessive log duplication from double-wrapping

      await browser.execute(() => {
        console.info('First execute call');
      });

      await browser.execute(() => {
        console.info('Second execute call');
      });

      await browser.execute(() => {
        console.info('Third execute call');
      });

      await browser.waitUntil(
        async () => {
          const logs = readWdioLogs(getLogDir());
          return (
            logs.includes('First execute call') &&
            logs.includes('Second execute call') &&
            logs.includes('Third execute call')
          );
        },
        { timeout: 10000, timeoutMsg: 'All execute logs not captured' },
      );

      const logs = readWdioLogs(getLogDir());

      // Count occurrences - should be exactly 1 for each
      const firstCount = (logs.match(/First execute call/g) || []).length;
      const secondCount = (logs.match(/Second execute call/g) || []).length;
      const thirdCount = (logs.match(/Third execute call/g) || []).length;

      expect(firstCount).toBe(1);
      expect(secondCount).toBe(1);
      expect(thirdCount).toBe(1);
    });
  });

  describe('Process Cleanup (Issue #5 Fix)', () => {
    it('should properly terminate tauri-driver after tests', async () => {
      // This test verifies that the process cleanup fix works
      // by checking that the browser session can be deleted cleanly
      const sessionId = browser.sessionId;
      expect(sessionId).toBeDefined();

      // Delete session - this should not hang or throw
      await browser.deleteSession();

      // Verify session is deleted
      expect(browser.sessionId).toBeUndefined();
    });
  });
});
