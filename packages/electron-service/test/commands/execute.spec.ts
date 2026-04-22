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
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '() => 1 + 2 + 3');
    expect(globalThis.wdioElectron.execute).toHaveBeenCalledWith('() => 1 + 2 + 3', []);
  });

  it('should handle scripts with quotes', async () => {
    const scriptWithQuotes = '() => "He said \\"hello\\""';
    await execute(globalThis.browser, scriptWithQuotes);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), scriptWithQuotes);
  });

  it('should handle scripts with newlines', async () => {
    const scriptWithNewlines = '() => "line1\\nline2"';
    await execute(globalThis.browser, scriptWithNewlines);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), scriptWithNewlines);
  });

  it('should handle scripts with unicode', async () => {
    const scriptWithUnicode = '() => "Hello 世界"';
    await execute(globalThis.browser, scriptWithUnicode);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), scriptWithUnicode);
  });

  it('should handle scripts with backslashes', async () => {
    const scriptWithBackslashes = '() => "C:\\\\path\\\\file"';
    await execute(globalThis.browser, scriptWithBackslashes);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), scriptWithBackslashes);
  });

  it('should handle mixed special characters', async () => {
    const script = '() => "Test \\n \\t \\u001b and \\\\ backslash"';
    await execute(globalThis.browser, script);
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), script);
  });

  it('should wrap expression-style string scripts in async IIFE with return', async () => {
    await execute(globalThis.browser, '1 + 2 + 3');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return 1 + 2 + 3; })()'),
    );
  });

  it('should wrap statement-style string scripts in async IIFE without adding return', async () => {
    await execute(globalThis.browser, 'return 42');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return 42 })()'),
    );
  });

  it('should wrap multi-statement string scripts in async IIFE', async () => {
    await execute(globalThis.browser, 'const x = 10; const y = 20; return x + y;');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => {'),
    );
  });

  it('should handle return(expr) pattern without adding extra return', async () => {
    // return() pattern should be treated as statement, not expression
    await execute(globalThis.browser, 'return(document.title)');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return(document.title) })()'),
    );
  });

  it('should not false-positive on semicolons inside string literals', async () => {
    // Semicolons inside string literals should not trigger statement detection
    await execute(globalThis.browser, '"foo;bar"');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return "foo;bar"; })()'),
    );
  });

  it('should treat document.title as expression (do prefix false positive)', async () => {
    // "document.title" starts with "do" but is NOT a statement - should add return
    await execute(globalThis.browser, 'document.title');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return document.title; })()'),
    );
  });

  it('should treat forEach() as expression (for prefix false positive)', async () => {
    // "[1,2,3].forEach()" starts with "for" but is NOT a statement - should add return
    await execute(globalThis.browser, '[1,2,3].forEach(x => x)');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), expect.stringContaining('return'));
  });

  it('should treat trySomething() as expression (try prefix false positive)', async () => {
    // "trySomething()" starts with "try" but is NOT a statement - should add return
    await execute(globalThis.browser, 'trySomething()');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return trySomething(); })()'),
    );
  });

  it('should treat asyncData.fetchAll() as expression (async prefix false positive)', async () => {
    await execute(globalThis.browser, 'asyncData.fetchAll()');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return asyncData.fetchAll(); })()'),
    );
  });

  it('should treat functionResult.call() as expression (function prefix false positive)', async () => {
    await execute(globalThis.browser, 'functionResult.call()');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return functionResult.call(); })()'),
    );
  });

  it('should treat (document.title) as expression (paren without arrow)', async () => {
    await execute(globalThis.browser, '(document.title)');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return (document.title); })()'),
    );
  });

  it('should treat (a + b) as expression (paren without arrow)', async () => {
    await execute(globalThis.browser, '(a + b)');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(
      expect.any(Function),
      expect.stringContaining('(async () => { return (a + b); })()'),
    );
  });

  it('should treat (x, y) => x + y as function-like (paren arrow)', async () => {
    await execute(globalThis.browser, '(x, y) => x + y');
    expect(globalThis.browser.execute).toHaveBeenCalledWith(expect.any(Function), '(x, y) => x + y');
  });
});
