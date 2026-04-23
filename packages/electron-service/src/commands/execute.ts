import { hasSemicolonOutsideQuotes, hasTopLevelArrow } from '../utils.js';

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

function wrapStringScript(script: string): string {
  const trimmed = script.trim();

  const isFunctionLike =
    (trimmed.startsWith('(') && hasTopLevelArrow(trimmed)) ||
    /^function[\s(]/.test(trimmed) ||
    /^async[\s(]/.test(trimmed) ||
    /^(\w+)\s*=>/.test(trimmed);

  if (isFunctionLike) {
    // Function-like string - pass through as-is (CDP can handle it)
    return script;
  }

  // Check if script has statements - be smarter about semicolons and keywords
  // Only count semicolons outside of quotes/brackets
  const hasRealSemicolon = hasSemicolonOutsideQuotes(trimmed);
  // Match statement keywords at start: const, let, var, if, for, while, switch, throw, try, do
  // Use word boundary check to avoid matching expressions like "document.title" (do) or "forEach()" (for)
  const hasStatementKeyword = /^(const|let|var|if|for|while|switch|throw|try|do|return)(?=\s|[(]|$)/.test(trimmed);

  if (hasRealSemicolon || hasStatementKeyword) {
    // Multi-statement or statement-style script
    return `(() => { ${script} })()`;
  } else {
    // Pure expression - add return and wrap in async IIFE
    return `(() => { return ${script}; })()`;
  }
}
