export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  script: string | ((...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue | undefined> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  /**
   * Wrap string scripts for proper execution
   * - Function-like strings (() => ..., function() {}, async () =>): pass through as-is
   * - Pure expressions (e.g., "1 + 2 + 3"): add return and wrap in IIFE
   * - Statement scripts (e.g., "return 42", "const x = 1"): wrap in IIFE without adding return
   */
  const scriptString = typeof script === 'function' ? script.toString() : wrapStringScript(script);

  const returnValue = await browser.execute(
    function executeWithinElectron(script: string, ...args) {
      return window.wdioElectron.execute(script, args);
    },
    scriptString,
    ...args,
  );

  return (returnValue as ReturnValue) ?? undefined;
}

/**
 * Wrap string scripts in async IIFE for proper execution in Electron
 * - Function-like strings (() => ..., function() {}, async () =>): pass through as-is
 * - Pure expressions (e.g., "1 + 2 + 3"): add return and wrap in IIFE
 * - Statement scripts (e.g., "return 42", "const x = 1"): wrap in IIFE without adding return
 */
function wrapStringScript(script: string): string {
  const trimmed = script.trim();

  // Check if it's a function-like string (should be passed through as-is)
  const isFunctionLike =
    trimmed.startsWith('(') ||
    trimmed.startsWith('function') ||
    trimmed.startsWith('async') ||
    /\w+\s*=>/.test(trimmed); // single-param arrow like "x => x + 1"

  if (isFunctionLike) {
    // Function-like string - pass through as-is (CDP can handle it)
    return script;
  }

  // Check if script has statements (semicolons or statement keywords at start)
  const hasSemicolon = trimmed.includes(';');
  const hasStatementKeyword = /^(const|let|var|if|for|while|switch|throw|try|do|return)\s/.test(trimmed);

  if (hasSemicolon || hasStatementKeyword) {
    // Multi-statement or statement-style script - wrap in async IIFE
    return `(async () => { ${script} })()`;
  } else {
    // Pure expression - add return and wrap in async IIFE
    return `(async () => { return ${script}; })()`;
  }
}
