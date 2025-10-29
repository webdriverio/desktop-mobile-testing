import { createLogger } from '@wdio/native-utils';
import type { TauriCommandContext, TauriResult } from '../types.js';

const log = createLogger('tauri-service', 'service');

/**
 * Execute a Tauri command
 */
export async function executeTauriCommand<T = unknown>(
  browser: WebdriverIO.Browser,
  command: string,
  ...args: unknown[]
): Promise<TauriResult<T>> {
  log.debug(`Executing Tauri command: ${command} with args:`, args);

  try {
    // Execute Tauri command via WebDriver
    const result = await browser.execute(
      (cmd: string, ...cmdArgs: unknown[]) => {
        console.log('🔍 Executing Tauri command:', cmd, 'with args:', cmdArgs);

        // Tauri v2 uses window.__TAURI__.core.invoke
        // @ts-expect-error - Tauri command API injected at runtime
        const invokeResult = window.__TAURI__.core.invoke(cmd, ...cmdArgs);
        console.log('🔍 Tauri invoke result:', invokeResult);
        return invokeResult;
      },
      command,
      ...args,
    );

    log.debug(`Tauri command result:`, result);

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
