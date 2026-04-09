import { beforeEach, describe, expect, it, vi } from 'vitest';

import { execute } from '../../src/commands/execute.js';

describe('execute Command', () => {
  beforeEach(async () => {
    globalThis.browser = {
      electron: {},
      execute: vi.fn((fn: (script: string, ...args: unknown[]) => unknown, script: string, ...args: unknown[]) =>
        typeof fn === 'string' ? new Function(`return (${fn}).apply(this, arguments)`)() : fn(script, ...args),
      ),
    } as unknown as WebdriverIO.Browser;

    globalThis.wdioElectron = {
      execute: vi.fn(),
    };
  });

  it('should throw an error when called with a script argument of the wrong type', async () => {
    await expect(() => execute(globalThis.browser, {} as string)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when called without a script argument', async () => {
    // @ts-expect-error no script argument
    await expect(() => execute(globalThis.browser)).rejects.toThrowError(
      new Error('Expecting script to be type of "string" or "function"'),
    );
  });

  it('should throw an error when the browser is not initialised', async () => {
    // @ts-expect-error no browser argument
    await expect(() => execute(undefined, '() => 1 + 2 + 3')).rejects.toThrowError(
      new Error('WDIO browser is not yet initialised'),
    );
  });

  it('should execute a function', async () => {
    await execute(globalThis.browser, (a, b, c) => a + b + c, 1, 2, 3);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '(a, b, c) => a + b + c', 1, 2, 3);
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith('(a, b, c) => a + b + c', [1, 2, 3]);
  });

  it('should execute a stringified function', async () => {
    await execute(globalThis.browser, '() => 1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), JSON.stringify('() => 1 + 2 + 3'));
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith(JSON.stringify('() => 1 + 2 + 3'), []);
  });

  it('should handle scripts with quotes', async () => {
    const scriptWithQuotes = '() => "He said \\"hello\\""';
    await execute(globalThis.browser, scriptWithQuotes);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), JSON.stringify(scriptWithQuotes));
  });

  it('should handle scripts with newlines', async () => {
    const scriptWithNewlines = '() => "line1\\nline2"';
    await execute(globalThis.browser, scriptWithNewlines);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), JSON.stringify(scriptWithNewlines));
  });

  it('should handle scripts with unicode', async () => {
    const scriptWithUnicode = '() => "Hello 世界"';
    await execute(globalThis.browser, scriptWithUnicode);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), JSON.stringify(scriptWithUnicode));
  });

  it('should handle scripts with backslashes', async () => {
    const scriptWithBackslashes = '() => "C:\\\\path\\\\file"';
    await execute(globalThis.browser, scriptWithBackslashes);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      JSON.stringify(scriptWithBackslashes),
    );
  });

  it('should handle mixed special characters', async () => {
    const script = '() => "Test \\n \\t \\u001b and \\\\ backslash"';
    await execute(globalThis.browser, script);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), JSON.stringify(script));
  });
});
