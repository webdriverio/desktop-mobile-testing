import type { TauriAPIs } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import type { TauriCommandContext, TauriResult } from '../types.js';

const log = createLogger('tauri-service', 'service');

/**
 * Execute JavaScript code in the Tauri frontend context with access to Tauri APIs
 * Matches Electron's execute pattern: accepts functions or strings, passes Tauri APIs as first parameter
 */
export async function execute<ReturnValue, InnerArguments extends unknown[]>(
  browser: WebdriverIO.Browser,
  script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
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

  // Check if plugin is available with retry logic (handles async module loading)
  const pluginAvailable = await browser.executeAsync((done) => {
    const checkPlugin = () => {
      // @ts-expect-error - Plugin API injected at runtime
      return typeof window.wdioTauri !== 'undefined' && typeof window.wdioTauri.execute === 'function';
    };

    // If already available, return immediately
    if (checkPlugin()) {
      done(true);
      return;
    }

    // Otherwise, poll for up to 5 seconds
    const startTime = Date.now();
    const timeout = 5000;
    const interval = 50;

    const poll = () => {
      if (checkPlugin()) {
        done(true);
      } else if (Date.now() - startTime > timeout) {
        done(false);
      } else {
        setTimeout(poll, interval);
      }
    };

    poll();
  });

  if (!pluginAvailable) {
    throw new Error(
      'Tauri plugin not available. Make sure @wdio/tauri-plugin is installed and registered in your Tauri app.',
    );
  }

  // Convert function to string - keep parameters intact, plugin will inject tauri as first arg
  const scriptString = typeof script === 'function' ? script.toString() : script;

  // Execute via plugin's execute command
  // The plugin will inject the Tauri APIs object as the first argument
  const result = await browser.execute(
    function executeWithinTauri(script: string, ...args) {
      // @ts-expect-error - Plugin API injected at runtime
      return window.wdioTauri.execute(script, args);
    },
    scriptString,
    ...args,
  );

  log.debug(`Execute result:`, result);

  return (result as ReturnValue) ?? undefined;
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
    const result = await execute(browser, ({ core }) => core.invoke(command, ...args));

    return {
      success: true,
      data: result as T,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`Tauri command failed: ${errorMessage}`);

    return {
      success: false,
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
      success: false,
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
    if (!result.success) {
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
