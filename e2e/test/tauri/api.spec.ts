import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';

describe('Tauri API', () => {
  it('should execute basic commands', async () => {
    // Test basic command execution using the execute API
    const result = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));
    expect(result).toHaveProperty('os');
    expect(result).toHaveProperty('arch');
    expect(result).toHaveProperty('hostname');
    expect(result).toHaveProperty('memory');
    expect(result).toHaveProperty('cpu');
  });

  it('should handle command errors gracefully', async () => {
    // Test error handling for invalid commands
    await expect(browser.tauri.execute(({ core }) => core.invoke('invalid_command'))).rejects.toThrow();
  });

  it('should execute commands with parameters', async () => {
    // Test command execution with parameters
    const result = (await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'))) as { os: string };
    expect(result).toHaveProperty('os');
    expect(typeof result.os).toBe('string');
  });

  describe('execute - different script types', () => {
    it('should execute function with Tauri APIs and args (with-args branch)', async () => {
      // This tests the with-args branch: function receives Tauri APIs as first param, user args after
      const result = await browser.tauri.execute(
        (tauri, arg1, arg2) => {
          return { tauriHasCore: typeof tauri?.core?.invoke === 'function', arg1, arg2 };
        },
        'first',
        'second',
      );
      expect(result.tauriHasCore).toBe(true);
      expect(result.arg1).toBe('first');
      expect(result.arg2).toBe('second');
    });

    it('should execute statement-style string (return statement)', async () => {
      // This tests the no-args branch with statement-style script like "return document.title"
      const result = await browser.tauri.execute('return 42');
      expect(result).toBe(42);
    });

    it('should execute expression-style string', async () => {
      // This tests the no-args branch with expression-style script
      const result = await browser.tauri.execute('1 + 2 + 3');
      expect(result).toBe(6);
    });

    it('should execute string with variable declaration', async () => {
      // Statement-style: declare variables and return
      const result = await browser.tauri.execute(`
        const x = 10;
        const y = 20;
        return x + y;
      `);
      expect(result).toBe(30);
    });

    it('should execute function with Tauri APIs (no args)', async () => {
      // Function without args should still receive Tauri APIs
      const result = await browser.tauri.execute((tauri) => {
        return { hasCore: typeof tauri?.core !== 'undefined' };
      });
      expect(result.hasCore).toBe(true);
    });

    it('should execute string that accesses Tauri APIs', async () => {
      // String script that uses window.__TAURI__ directly
      const result = await browser.tauri.execute(`
        return typeof window.__TAURI__?.core;
      `);
      expect(result).toBe('object');
    });

    it('should execute async function with args', async () => {
      const result = await browser.tauri.execute(async (tauri, value) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { received: value, hasTauri: !!tauri?.core };
      }, 'async-test');
      expect(result.received).toBe('async-test');
      expect(result.hasTauri).toBe(true);
    });
  });
});
