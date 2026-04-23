import { hasSemicolonOutsideQuotes, hasTopLevelArrow } from '@wdio/native-utils';

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
    return script;
  }

  const hasRealSemicolon = hasSemicolonOutsideQuotes(trimmed);
  const hasStatementKeyword = /^(const|let|var|if|for|while|switch|throw|try|do|return)(?=\s|[(]|$)/.test(trimmed);

  if (hasRealSemicolon || hasStatementKeyword) {
    return `(async () => { ${script} })()`;
  } else {
    return `(async () => { return ${script}; })()`;
  }
}
