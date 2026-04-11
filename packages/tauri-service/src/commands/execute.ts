import type { TauriAPIs } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import type { TauriCommandContext, TauriResult } from '../types.js';

const log = createLogger('tauri-service', 'service');

// WeakMap to store plugin availability per browser session
// Automatically cleans up when browser objects are garbage collected
const pluginAvailabilityCache = new WeakMap<WebdriverIO.Browser, boolean>();

/**
 * Execute JavaScript code in the Tauri frontend context with access to Tauri APIs
 * Matches Electron's execute pattern: accepts functions or strings, passes Tauri APIs as first parameter
 */
export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
  ...args: InnerArguments
): Promise<ReturnValue> {
  /**
   * parameter check
   */
  if (typeof script !== 'string' && typeof script !== 'function') {
    throw new Error('Expecting script to be type of "string" or "function"');
  }

  if (!browser) {
    throw new Error('WDIO browser is not yet initialised');
  }

  // Check cache first using WeakMap - automatically cleans up when browser is GC'd
  if (!pluginAvailabilityCache.get(browser)) {
    // Check if plugin is available with retry logic (handles async module loading)
    // Use execute (sync) since executeAsync has issues with some embedded providers
    const maxAttempts = 100; // 100 attempts * 50ms = 5 seconds max
    const retryInterval = 50; // ms
    let pluginAvailable = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const result: unknown = await browser.execute(() => {
        // @ts-expect-error - Plugin API injected at runtime
        return typeof window.wdioTauri !== 'undefined' && typeof window.wdioTauri.execute === 'function';
      });
      pluginAvailable = result === true;

      if (pluginAvailable) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    if (!pluginAvailable) {
      throw new Error(
        'Tauri plugin not available. Make sure @wdio/tauri-plugin is installed and registered in your Tauri app.',
      );
    }

    // Cache the successful check using browser object as key
    pluginAvailabilityCache.set(browser, true);
    log.debug('Plugin availability cached for browser session');
  } else {
    log.debug('Plugin availability cached, skipping check');
  }

  // Convert function to string - keep parameters intact, plugin will handle escaping
  // For functions: use .toString() (produces valid JS function source)
  // For strings: send as-is (Rust handles proper escaping when args present)
  const scriptString = typeof script === 'function' ? script.toString() : script;

  // Execute via plugin's execute method
  // The plugin handles CSP-compliant script execution in the backend
  const result = await browser.execute(
    async function executeViaPlugin(script: string, ...scriptArgs: unknown[]) {
      // @ts-expect-error - Running in browser context
      if (typeof window.wdioTauri === 'undefined') {
        return JSON.stringify({ __wdio_error__: 'window.wdioTauri is undefined' });
      }
      // @ts-expect-error - Running in browser context
      if (typeof window.wdioTauri.execute !== 'function') {
        // @ts-expect-error - Running in browser context
        return JSON.stringify({ __wdio_error__: `window.wdioTauri.execute is ${typeof window.wdioTauri.execute}` });
      }

      try {
        // @ts-expect-error - Running in browser context
        const pluginResult = await window.wdioTauri.execute(script, ...scriptArgs);
        return JSON.stringify({ __wdio_value__: pluginResult });
      } catch (error) {
        return JSON.stringify({
          __wdio_error__: `Plugin execute error: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
    scriptString,
    ...args,
  );

  // Extract result or error from wrapped response
  let parsed: { __wdio_error__?: string; __wdio_value__?: unknown } | undefined;
  if (result && typeof result === 'string') {
    try {
      parsed = JSON.parse(result) as { __wdio_error__?: string; __wdio_value__?: unknown };
    } catch (parseError) {
      throw new Error(
        `Failed to parse execute result: ${parseError instanceof Error ? parseError.message : String(parseError)}, raw result: ${result}`,
      );
    }
  }

  // Check for script errors AFTER parsing (outside try/catch to avoid re-wrapping)
  if (parsed?.__wdio_error__) {
    throw new Error(parsed.__wdio_error__);
  }

  if (parsed?.__wdio_value__ !== undefined) {
    log.debug(`Execute result:`, parsed.__wdio_value__);
    return parsed.__wdio_value__ as ReturnValue;
  }

  log.debug(`Execute result:`, result);
  return result as ReturnValue;
}

/**
 * Execute a Tauri command (legacy method - kept for backward compatibility)
 * @deprecated Use execute() instead
 */
export async function executeTauriCommand<T = unknown>(
  browser: WebdriverIO.Browser,
  command: string,
  ...args: unknown[]
): Promise<TauriResult<T>> {
  log.debug(`Executing Tauri command: ${command} with args:`, args);

  try {
    const result = await execute(
      browser,
      ({ core }, invokeCommand: string, invokeArgs: unknown[]) => core.invoke(invokeCommand, ...invokeArgs),
      command,
      args,
    );

    return {
      ok: true,
      value: result as T,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Tauri command failed: ${errorMessage}`);

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute a Tauri command with timeout
 */
export async function executeTauriCommandWithTimeout<T = unknown>(
  browser: WebdriverIO.Browser,
  command: string,
  timeout: number = 30000,
  ...args: unknown[]
): Promise<TauriResult<T>> {
  log.debug(`Executing Tauri command with timeout ${timeout}ms: ${command}`);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tauri command timeout after ${timeout}ms`));
    }, timeout);
  });

  try {
    const result = await Promise.race([executeTauriCommand<T>(browser, command, ...args), timeoutPromise]);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Tauri command timeout or error: ${errorMessage}`);

    return {
      ok: false,
      error: errorMessage,
    };
  }
}

/**
 * Execute multiple Tauri commands in sequence
 */
export async function executeTauriCommands<T = unknown>(
  browser: WebdriverIO.Browser,
  commands: TauriCommandContext[],
): Promise<TauriResult<T>[]> {
  log.debug(`Executing ${commands.length} Tauri commands in sequence`);

  const results: TauriResult<T>[] = [];

  for (const { command, args, timeout } of commands) {
    const result = timeout
      ? await executeTauriCommandWithTimeout<T>(browser, command, timeout, ...args)
      : await executeTauriCommand<T>(browser, command, ...args);

    results.push(result);

    // Stop on first failure
    if (!result.ok) {
      log.warn(`Stopping command execution due to failure: ${result.error}`);
      break;
    }
  }

  return results;
}

/**
 * Execute Tauri commands in parallel
 */
export async function executeTauriCommandsParallel<T = unknown>(
  browser: WebdriverIO.Browser,
  commands: TauriCommandContext[],
): Promise<TauriResult<T>[]> {
  log.debug(`Executing ${commands.length} Tauri commands in parallel`);

  const promises = commands.map(({ command, args, timeout }) =>
    timeout
      ? executeTauriCommandWithTimeout<T>(browser, command, timeout, ...args)
      : executeTauriCommand<T>(browser, command, ...args),
  );

  return Promise.all(promises);
}

/**
 * Check if Tauri API is available
 */
export async function isTauriApiAvailable(browser: WebdriverIO.Browser): Promise<boolean> {
  try {
    const result = await browser.execute(() => {
      // @ts-expect-error - Tauri API injected at runtime
      return typeof window.__TAURI__ !== 'undefined';
    });

    return Boolean(result);
  } catch (error) {
    log.debug(`Tauri API not available: ${error}`);
    return false;
  }
}

/**
 * Get Tauri version
 */
export async function getTauriVersion(browser: WebdriverIO.Browser): Promise<TauriResult<string>> {
  return executeTauriCommand<string>(browser, 'get_tauri_version');
}

/**
 * Get Tauri app information
 */
export async function getTauriAppInfo(
  browser: WebdriverIO.Browser,
): Promise<TauriResult<{ name: string; version: string }>> {
  return executeTauriCommand<{ name: string; version: string }>(browser, 'get_app_info');
}
