import assert from 'node:assert';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  execute,
  executeTauriCommand,
  executeTauriCommands,
  executeTauriCommandsParallel,
  executeTauriCommandWithTimeout,
  getTauriAppInfo,
  getTauriVersion,
  isTauriApiAvailable,
} from '../../src/commands/execute.js';

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function createMockBrowser(executeFn?: (...args: unknown[]) => unknown) {
  return {
    execute: vi.fn(executeFn ?? (() => undefined)),
  } as unknown as WebdriverIO.Browser;
}

describe('execute', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    // Fresh browser object each test so WeakMap cache is empty
    browser = createMockBrowser();
  });

  describe('parameter validation', () => {
    it('should throw when script is not a string or function', async () => {
      await expect(() => execute(browser, {} as string)).rejects.toThrow(
        'Expecting script to be type of "string" or "function"',
      );
    });

    it('should throw when script is a number', async () => {
      await expect(() => execute(browser, 42 as unknown as string)).rejects.toThrow(
        'Expecting script to be type of "string" or "function"',
      );
    });

    it('should throw when script is undefined', async () => {
      await expect(() => execute(browser, undefined as unknown as string)).rejects.toThrow(
        'Expecting script to be type of "string" or "function"',
      );
    });

    it('should throw when browser is undefined', async () => {
      await expect(() => execute(undefined as unknown as WebdriverIO.Browser, '() => 1')).rejects.toThrow(
        'WDIO browser is not yet initialised',
      );
    });
  });

  describe('plugin availability check', () => {
    it('should throw when plugin is never available after max retries', async () => {
      vi.useFakeTimers();
      const mockExecute = vi.fn().mockResolvedValue(false);
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const promise = execute(browser, '() => 1').catch((e: Error) => e);

      // Advance through all 100 retry intervals (50ms each)
      for (let i = 0; i < 100; i++) {
        await vi.advanceTimersByTimeAsync(50);
      }

      const result = await promise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain(
        'Tauri plugin not available. Make sure @wdio/tauri-plugin is installed and registered in your Tauri app.',
      );
    });

    it('should succeed when plugin becomes available after retries', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const mockExecute = vi.fn().mockImplementation((..._args: unknown[]) => {
        callCount++;
        // First 3 calls: plugin check returns false
        // 4th call: plugin check returns true
        // 5th call: the actual execute call
        if (callCount <= 3) {
          return Promise.resolve(false);
        }
        if (callCount === 4) {
          return Promise.resolve(true);
        }
        return Promise.resolve(JSON.stringify({ __wdio_value__: 'result' }));
      });
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const promise = execute<string, []>(browser, '() => "result"');

      // Advance timers for the 3 failed retries
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(50);
      }
      // Let the successful check and execute call resolve
      await vi.advanceTimersByTimeAsync(0);

      const result = await promise;
      expect(result).toBe('result');
      // 3 failed checks + 1 successful check + 1 actual execute = 5 calls
      expect(mockExecute).toHaveBeenCalledTimes(5);
    });

    it('should use cached result on second call with same browser', async () => {
      let callCount = 0;
      const mockExecute = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(true); // plugin check
        }
        return Promise.resolve(JSON.stringify({ __wdio_value__: 'result' }));
      });
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await execute<string, []>(browser, '() => "result"');
      const firstCallCount = callCount;

      // Reset to track second call
      await execute<string, []>(browser, '() => "result2"');

      // Second call should skip the plugin check (cached), so only 1 additional call
      expect(callCount).toBe(firstCallCount + 1);
    });

    it('should not share cache between different browser objects', async () => {
      const browser1 = createMockBrowser();
      const browser2 = createMockBrowser();
      const calls1: number[] = [];
      const calls2: number[] = [];

      let count1 = 0;
      (browser1.execute as ReturnType<typeof vi.fn>).mockImplementation(() => {
        count1++;
        calls1.push(count1);
        if (count1 === 1) return Promise.resolve(true);
        return Promise.resolve(JSON.stringify({ __wdio_value__: 'b1' }));
      });

      let count2 = 0;
      (browser2.execute as ReturnType<typeof vi.fn>).mockImplementation(() => {
        count2++;
        calls2.push(count2);
        if (count2 === 1) return Promise.resolve(true);
        return Promise.resolve(JSON.stringify({ __wdio_value__: 'b2' }));
      });

      await execute<string, []>(browser1, '() => "b1"');
      await execute<string, []>(browser2, '() => "b2"');

      // Both should have done the plugin check (2 calls each: check + execute)
      expect(calls1).toHaveLength(2);
      expect(calls2).toHaveLength(2);
    });
  });

  describe('function serialization', () => {
    it('should convert functions to strings', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true); // plugin check
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 42 }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const fn = (_tauri: unknown, a: number, b: number) => a + b;
      await execute(browser, fn, 1, 2);

      // Second call is the actual execute - first arg is the inner function, second is the stringified script
      const secondCall = mockExecute.mock.calls[1];
      expect(secondCall[1]).toBe(fn.toString());
      expect(secondCall[2]).toBe(1);
      expect(secondCall[3]).toBe(2);
    });

    it('should pass strings as-is to the plugin', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'hello' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await execute<string, []>(browser, 'return "hello"');

      const secondCall = mockExecute.mock.calls[1];
      expect(secondCall[1]).toBe('return "hello"');
    });
  });

  describe('result parsing', () => {
    it('should parse __wdio_value__ from JSON response', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: { foo: 'bar' } }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<{ foo: string }, []>(browser, '() => ({ foo: "bar" })');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null __wdio_value__', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: null }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<null, []>(browser, '() => null');
      // null is not undefined, so __wdio_value__ !== undefined is true
      expect(result).toBeNull();
    });

    it('should return raw result when response is not a string', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(42);
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<number, []>(browser, '() => 42');
      expect(result).toBe(42);
    });

    it('should return raw result when __wdio_value__ is undefined in parsed response', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ other_key: 'value' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<string, []>(browser, '() => "something"');
      // JSON parsed successfully, no __wdio_error__, __wdio_value__ is undefined
      // Falls through to return raw result
      expect(result).toBe(JSON.stringify({ other_key: 'value' }));
    });

    it('should throw when JSON parse fails on a non-JSON string', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce('not-valid-json');
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow(
        /Failed to parse execute result:.*raw result: not-valid-json/,
      );
    });

    it('should return raw result when response is null', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(null);
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<null, []>(browser, '() => null');
      expect(result).toBeNull();
    });

    it('should return raw result when response is undefined', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(undefined);
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      const result = await execute<undefined, []>(browser, '() => undefined');
      expect(result).toBeUndefined();
    });
  });

  describe('error wrapping', () => {
    it('should throw when response contains __wdio_error__', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'something went wrong' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow('something went wrong');
    });

    it('should throw for window undefined error', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'window is undefined' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow(/window is undefined/);
    });

    it('should throw for wdioTauri undefined error', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'window.wdioTauri is undefined' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow(
        /window\.wdioTauri is undefined/,
      );
    });

    it('should throw for promise error', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'Promise error: async failure' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow(/Promise error: async failure/);
    });

    it('should throw for execute call error', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'Execute call error: boom' }));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow(/Execute call error: boom/);
    });

    it('should throw when browser.execute rejects', async () => {
      const mockExecute = vi.fn();
      mockExecute.mockResolvedValueOnce(true);
      mockExecute.mockRejectedValueOnce(new Error('WebDriver session expired'));
      browser = createMockBrowser();
      (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

      await expect(() => execute<string, []>(browser, '() => "fail"')).rejects.toThrow('WebDriver session expired');
    });
  });
});

describe('executeTauriCommand', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should pass command and args as function arguments, not closure references', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true); // plugin check
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'test-result' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    await executeTauriCommand<string>(browser, 'get_version', 'arg1', 42);

    // The second call is the actual execute - verify command and args are passed as separate arguments
    // This ensures they don't become closure references in the serialized script
    const secondCall = mockExecute.mock.calls[1];
    // Script is converted to string by execute(), but command and args are passed separately
    expect(secondCall[1]).toBe('({ core }, invokeCommand, invokeArgs) => core.invoke(invokeCommand, ...invokeArgs)');
    expect(secondCall[2]).toBe('get_version');
    expect(secondCall[3]).toEqual(['arg1', 42]);
  });

  it('should return ok result on success', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'command-result' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await executeTauriCommand<string>(browser, 'my_command', 'arg1', 'arg2');
    expect(result).toEqual({ ok: true, value: 'command-result' });
  });

  it('should return error result on failure', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'command failed' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await executeTauriCommand<string>(browser, 'my_command');
    assert(!result.ok);
    expect(result.error).toContain('command failed');
  });

  it('should return error result when plugin is unavailable', async () => {
    vi.useFakeTimers();
    (browser.execute as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const promise = executeTauriCommand(browser, 'my_command');

    for (let i = 0; i < 100; i++) {
      await vi.advanceTimersByTimeAsync(50);
    }

    const result = await promise;
    assert(!result.ok);
    expect(result.error).toContain('Tauri plugin not available');

    vi.useRealTimers();
  });
});

describe('executeTauriCommandWithTimeout', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    browser = createMockBrowser();
  });

  it('should return result when command completes before timeout', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'fast-result' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await executeTauriCommandWithTimeout<string>(browser, 'fast_command', 5000);
    expect(result).toEqual({ ok: true, value: 'fast-result' });
  });

  it('should return error result when command times out', async () => {
    vi.useFakeTimers();
    const mockExecute = vi.fn();
    // Plugin check succeeds
    mockExecute.mockResolvedValueOnce(true);
    // The actual execute never resolves (simulating a hang)
    mockExecute.mockImplementationOnce(() => new Promise(() => {}));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const promise = executeTauriCommandWithTimeout<string>(browser, 'slow_command', 100);

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    assert(!result.ok);
    expect(result.error).toContain('timeout after 100ms');

    vi.useRealTimers();
  });

  it('should use default timeout of 30000ms', async () => {
    vi.useFakeTimers();
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockImplementationOnce(() => new Promise(() => {}));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const promise = executeTauriCommandWithTimeout<string>(browser, 'slow_command');

    await vi.advanceTimersByTimeAsync(30000);

    const result = await promise;
    assert(!result.ok);
    expect(result.error).toContain('timeout after 30000ms');

    vi.useRealTimers();
  });
});

describe('executeTauriCommands', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should execute commands sequentially and return all results', async () => {
    let callCount = 0;
    const mockExecute = vi.fn().mockImplementation(() => {
      callCount++;
      // First call: plugin check for first command
      if (callCount === 1) return Promise.resolve(true);
      // Second call: execute first command
      if (callCount === 2) return Promise.resolve(JSON.stringify({ __wdio_value__: 'result1' }));
      // Third call: execute second command (cache hit, no plugin check)
      if (callCount === 3) return Promise.resolve(JSON.stringify({ __wdio_value__: 'result2' }));
      return Promise.resolve(JSON.stringify({ __wdio_value__: 'unexpected' }));
    });
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const results = await executeTauriCommands<string>(browser, [
      { command: 'cmd1', args: [] },
      { command: 'cmd2', args: [] },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ ok: true, value: 'result1' });
    expect(results[1]).toEqual({ ok: true, value: 'result2' });
  });

  it('should stop at first failure', async () => {
    let callCount = 0;
    const mockExecute = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(true);
      if (callCount === 2) return Promise.resolve(JSON.stringify({ __wdio_error__: 'cmd1 failed' }));
      return Promise.resolve(JSON.stringify({ __wdio_value__: 'should not reach' }));
    });
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const results = await executeTauriCommands<string>(browser, [
      { command: 'cmd1', args: [] },
      { command: 'cmd2', args: [] },
      { command: 'cmd3', args: [] },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].ok).toBe(false);
  });

  it('should use timeout variant when timeout is specified', async () => {
    let callCount = 0;
    const mockExecute = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(true);
      if (callCount === 2) return Promise.resolve(JSON.stringify({ __wdio_value__: 'timed-result' }));
      return Promise.resolve(JSON.stringify({ __wdio_value__: 'result2' }));
    });
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const results = await executeTauriCommands<string>(browser, [
      { command: 'cmd1', args: ['a'], timeout: 5000 },
      { command: 'cmd2', args: [] },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ ok: true, value: 'timed-result' });
  });

  it('should handle empty commands array', async () => {
    const results = await executeTauriCommands(browser, []);
    expect(results).toEqual([]);
  });
});

describe('executeTauriCommandsParallel', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should execute all commands in parallel', async () => {
    // Pre-cache plugin availability with a sequential call first
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true); // plugin check
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'warmup' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    // Warm up the cache
    await executeTauriCommand(browser, 'warmup');

    // Now set up mocks for parallel calls (no plugin check needed - cached)
    mockExecute.mockReset();
    mockExecute.mockResolvedValue(JSON.stringify({ __wdio_value__: 'parallel-result' }));

    const results = await executeTauriCommandsParallel<string>(browser, [
      { command: 'cmd1', args: [] },
      { command: 'cmd2', args: [] },
      { command: 'cmd3', args: [] },
    ]);

    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.ok).toBe(true);
    }
  });

  it('should return all results including failures', async () => {
    // Pre-cache plugin availability
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true); // plugin check
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'warmup' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    await executeTauriCommand(browser, 'warmup');

    // Now set up for parallel calls
    mockExecute.mockReset();
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: 'ok' }));
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'cmd2 failed' }));

    const results = await executeTauriCommandsParallel<string>(browser, [
      { command: 'cmd1', args: [] },
      { command: 'cmd2', args: [] },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ ok: true, value: 'ok' });
    expect(results[1].ok).toBe(false);
  });

  it('should use timeout variant when timeout is specified', async () => {
    let callCount = 0;
    const mockExecute = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(true);
      return Promise.resolve(JSON.stringify({ __wdio_value__: 'done' }));
    });
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const results = await executeTauriCommandsParallel<string>(browser, [{ command: 'cmd1', args: [], timeout: 5000 }]);

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ ok: true, value: 'done' });
  });

  it('should handle empty commands array', async () => {
    const results = await executeTauriCommandsParallel(browser, []);
    expect(results).toEqual([]);
  });
});

describe('isTauriApiAvailable', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should return true when __TAURI__ is available', async () => {
    (browser.execute as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const result = await isTauriApiAvailable(browser);
    expect(result).toBe(true);
  });

  it('should return false when __TAURI__ is not available', async () => {
    (browser.execute as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const result = await isTauriApiAvailable(browser);
    expect(result).toBe(false);
  });

  it('should return false when browser.execute throws', async () => {
    (browser.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('session not found'));

    const result = await isTauriApiAvailable(browser);
    expect(result).toBe(false);
  });

  it('should coerce truthy values to boolean', async () => {
    (browser.execute as ReturnType<typeof vi.fn>).mockResolvedValue(1);

    const result = await isTauriApiAvailable(browser);
    expect(result).toBe(true);
  });

  it('should coerce falsy values to boolean', async () => {
    (browser.execute as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const result = await isTauriApiAvailable(browser);
    expect(result).toBe(false);
  });
});

describe('getTauriVersion', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should return version string on success', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: '2.1.0' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await getTauriVersion(browser);
    expect(result).toEqual({ ok: true, value: '2.1.0' });
  });

  it('should return error result on failure', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'version not found' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await getTauriVersion(browser);
    assert(!result.ok);
    expect(result.error).toContain('version not found');
  });
});

describe('getTauriAppInfo', () => {
  let browser: WebdriverIO.Browser;

  beforeEach(() => {
    vi.restoreAllMocks();
    browser = createMockBrowser();
  });

  it('should return app info on success', async () => {
    const appInfo = { name: 'my-app', version: '1.0.0' };
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_value__: appInfo }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await getTauriAppInfo(browser);
    expect(result).toEqual({ ok: true, value: appInfo });
  });

  it('should return error result on failure', async () => {
    const mockExecute = vi.fn();
    mockExecute.mockResolvedValueOnce(true);
    mockExecute.mockResolvedValueOnce(JSON.stringify({ __wdio_error__: 'app info unavailable' }));
    (browser.execute as ReturnType<typeof vi.fn>).mockImplementation(mockExecute);

    const result = await getTauriAppInfo(browser);
    assert(!result.ok);
    expect(result.error).toContain('app info unavailable');
  });
});
