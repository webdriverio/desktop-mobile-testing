import * as babelParser from '@babel/parser';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('electron-service', 'service');

import { parse, print } from 'recast';
import type { ElectronCdpBridge } from '../bridge';

import mockStore from '../mockStore.js';
import { isInternalCommand } from '../utils.js';

const CACHE_MAX_SIZE = 100;
const cache = new Map<string, string>();

export function clearParsedFunctionCache(): void {
  cache.clear();
}

export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  cdpBridge: ElectronCdpBridge | undefined,
  script: string | ((electron: typeof Electron.CrossProcessExports, ...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue | ReturnValue[] | undefined> {
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  if (browser.isMultiremote) {
    const mrBrowser = browser as unknown as WebdriverIO.MultiRemoteBrowser;
    return await Promise.all(
      mrBrowser.instances.map(async (instance) => {
        const mrInstance = mrBrowser.getInstance(instance);
        return mrInstance.electron.execute(script, ...args);
      }),
    );
  }

  if (!cdpBridge) {
    log.error('CDP Bridge is not available - browser.electron.execute() cannot access the main process');
    log.error('This may occur if the EnableNodeCliInspectArguments fuse is disabled in your Electron binary');
    log.error('See: https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect');
    return undefined;
  }

  // Handle string scripts - wrap them in async IIFE before parsing
  // This prevents recast from trying to parse them as function definitions
  // Only pass through to recast if it's clearly a function-like string that needs transformation
  let functionDeclaration: string;
  if (typeof script === 'string') {
    const trimmed = script.trim();
    // Only let recast handle arrow functions starting with ( and containing =>
    // These get transformed to add electron parameter
    const isArrowFunction = trimmed.startsWith('(') && trimmed.includes('=>') && !trimmed.includes('function');

    if (isArrowFunction) {
      // Arrow function - recast handles electron param injection
      functionDeclaration = getCachedOrParse(script);
    } else {
      // Not a simple arrow function - wrap it ourselves
      functionDeclaration = wrapStringScriptForCdp(script);
    }
  } else {
    functionDeclaration = getCachedOrParse(script.toString());
  }

  const argsArray = args.map((arg) => ({ value: arg }));

  log.debug('Executing script length:', Buffer.byteLength(functionDeclaration, 'utf-8'));

  const result = await cdpBridge.send('Runtime.callFunctionOn', {
    functionDeclaration,
    arguments: argsArray,
    awaitPromise: true,
    returnByValue: true,
    executionContextId: cdpBridge.contextId,
  });

  await syncMockStatus(args);

  return (result.result.value as ReturnValue) ?? undefined;
}

/**
 * Wrap string scripts in async IIFE for proper CDP execution
 * Handles statement and expression scripts that would otherwise fail parsing
 */
function wrapStringScriptForCdp(script: string): string {
  const trimmed = script.trim();

  // Check if it's a simple arrow function that can be transformed by recast
  // These patterns can be safely passed to recast which adds the electron parameter
  const canRecastHandle = trimmed.startsWith('(') && trimmed.includes('=>') && !trimmed.includes('function');

  if (canRecastHandle) {
    // Simple arrow function - pass to recast for transformation
    return script;
  }

  // For all other strings, wrap them to avoid parsing errors
  // This includes:
  // - "function() {}" (recast handles these differently)
  // - "1 + 2 + 3" (expression - would be called as function)
  // - "return 42" (statement - parsing error)
  // - "const x = 1" (statement - parsing error)

  const hasStatementKeyword = /^(const|let|var|if|for|while|switch|throw|try|do|return)(?=\s|[(]|$)/.test(trimmed);
  const hasRealSemicolon = hasSemicolonOutsideQuotes(trimmed);

  if (hasRealSemicolon || hasStatementKeyword) {
    return `(async () => { ${script} })()`;
  } else {
    return `(async () => { return ${script}; })()`;
  }
}

function hasSemicolonOutsideQuotes(str: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let bracketDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : '';

    if (prevChar === '\\') continue;

    if (char === "'" && !inDoubleQuote && !inTemplateLiteral) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inTemplateLiteral) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplateLiteral = !inTemplateLiteral;
    }

    if (!inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      if (char === '{' || char === '[' || char === '(') bracketDepth++;
      if (char === '}' || char === ']' || char === ')') bracketDepth--;
    }

    if (char === ';' && bracketDepth === 0 && !inSingleQuote && !inDoubleQuote && !inTemplateLiteral) {
      return true;
    }
  }

  return false;
}

async function syncMockStatus(args: unknown[]) {
  const mocks = mockStore.getMocks();
  if (mocks.length > 0 && !isInternalCommand(args)) {
    await Promise.all(mocks.map(async ([_mockId, mock]) => mock.update()));
  }
}

function getCachedOrParse(funcStr: string): string {
  const cached = cache.get(funcStr);
  if (cached) {
    return cached;
  }

  const result = stripElectronParameter(funcStr);

  if (cache.size >= CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  cache.set(funcStr, result);

  return result;
}

function stripElectronParameter(funcStr: string): string {
  const ast = parse(funcStr, {
    parser: {
      parse: (source: string) =>
        babelParser.parse(source, {
          sourceType: 'module',
          plugins: ['typescript'],
        }),
    },
  });

  const topLevelNode = ast.program.body[0];
  let funcNode = null;

  if (topLevelNode.type === 'ExpressionStatement') {
    // Arrow function
    funcNode = topLevelNode.expression;
  } else if (topLevelNode.type === 'FunctionDeclaration') {
    // Function declaration
    funcNode = topLevelNode;
  }

  if (!funcNode) {
    throw new Error('Unsupported function type');
  }

  // Remove first arg if it exists
  if ('params' in funcNode && Array.isArray(funcNode.params)) {
    funcNode.params.shift();
  }

  return print(ast).code;
}
