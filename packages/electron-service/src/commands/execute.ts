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

  // Check if script has statements - be smarter about semicolons and keywords
  // Only count semicolons outside of quotes/brackets
  const hasRealSemicolon = hasSemicolonOutsideQuotes(trimmed);
  // Match statement keywords at start: const, let, var, if, for, while, switch, throw, try, do
  // Also catch return followed by ( or whitespace (e.g., "return 42" or "return(expr)")
  const hasStatementKeyword = /^(const|let|var|if|for|while|switch|throw|try|do|return[(\s])/.test(trimmed);

  if (hasRealSemicolon || hasStatementKeyword) {
    // Multi-statement or statement-style script - wrap in async IIFE
    return `(async () => { ${script} })()`;
  } else {
    // Pure expression - add return and wrap in async IIFE
    return `(async () => { return ${script}; })()`;
  }
}

/**
 * Check for semicolons outside of string literals and template literals
 */
function hasSemicolonOutsideQuotes(str: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let bracketDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';

    // Handle escape sequences
    if (prevChar === '\\') continue;

    // Track quote states
    if (char === "'" && !inDoubleQuote && !inTemplateLiteral) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inTemplateLiteral) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplateLiteral = !inTemplateLiteral;
    }

    // Track bracket depth (for handling object/array literals inside quotes)
    if (!inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      if (char === '{' || char === '[' || char === '(') bracketDepth++;
      if (char === '}' || char === ']' || char === ')') bracketDepth--;
    }

    // Check for semicolon outside of quotes/brackets
    if (char === ';' && bracketDepth === 0 && !inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      return true;
    }
  }

  return false;
}
