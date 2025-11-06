/**
 * WebDriverIO Tauri Plugin - Frontend TypeScript/JavaScript API
 * Provides execute and mocking interfaces for testing
 */

import type { InvokeArgs } from '@tauri-apps/api/core';

// Lazy-load invoke function to support both global Tauri API and dynamic imports
// This allows the plugin to work both with bundlers (Vite) and without (plain ES modules)
let _invokeCache: ((cmd: string, args?: InvokeArgs) => Promise<unknown>) | null = null;

async function getInvoke(): Promise<(cmd: string, args?: InvokeArgs) => Promise<unknown>> {
  if (_invokeCache) {
    return _invokeCache;
  }

  // Check if window.__TAURI__ is available globally (withGlobalTauri: true)
  if (typeof window !== 'undefined' && window.__TAURI__?.core?.invoke) {
    _invokeCache = window.__TAURI__.core.invoke;
    return _invokeCache;
  }

  // Fallback to dynamic import for bundler environments
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    _invokeCache = invoke;
    return _invokeCache;
  } catch (_error) {
    throw new Error(
      'Tauri API not available. Make sure withGlobalTauri is enabled in tauri.conf.json or @tauri-apps/api is installed.',
    );
  }
}

// Type declarations for window extensions
declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: (cmd: string, args?: InvokeArgs) => Promise<unknown>;
      };
      log?: {
        info?: (message: string) => Promise<void>;
        error?: (message: string) => Promise<void>;
        warn?: (message: string) => Promise<void>;
        debug?: (message: string) => Promise<void>;
      };
    };
    wdioTauri?: {
      execute: (script: string, args?: unknown[]) => Promise<unknown>;
      setMock: (command: string, config: unknown) => Promise<void>;
      getMock: (command: string) => Promise<unknown | null>;
      clearMocks: () => Promise<void>;
      resetMocks: () => Promise<void>;
      restoreMocks: () => Promise<void>;
    };
  }
}

/**
 * Execute JavaScript code in the frontend context with access to Tauri APIs
 * The script will receive the Tauri APIs object as the first argument
 * @param script - JavaScript code to execute (function string without first parameter)
 * @param args - Arguments to pass to the script (after the Tauri APIs object)
 * @returns Result of the script execution
 */
export async function execute(script: string, args: unknown[] = []): Promise<unknown> {
  try {
    // Ensure window.__TAURI__ is available
    if (!window.__TAURI__) {
      throw new Error('window.__TAURI__ is not available. Make sure withGlobalTauri is enabled in tauri.conf.json');
    }

    // Serialize args to pass them to the plugin
    const argsJson = JSON.stringify(args);

    // Wrap the script to inject the Tauri APIs object as the first argument
    // The script is a function string that expects tauri APIs as first parameter
    // We need to wrap it to call it with window.__TAURI__ as the first argument
    // Note: We can't JSON.stringify window.__TAURI__ because it contains functions
    // Instead, we reference it directly in the wrapped script
    const wrappedScript = `
      (async () => {
        const __wdio_tauri = window.__TAURI__;
        const __wdio_args = ${argsJson};
        // Execute the script as a function with tauri as first arg, then spread additional args
        // Await the result in case it's a Promise (most Tauri commands return Promises)
        return await (${script})(__wdio_tauri, ...__wdio_args);
      })()
    `.trim();

    // Call the plugin command to execute the wrapped script
    // Tauri v2 plugin commands use format: plugin:plugin-name|command-name
    const invoke = await getInvoke();
    const result = await invoke('plugin:wdio|execute', {
      request: {
        script: wrappedScript,
        args: [],
      },
    } as InvokeArgs);
    return result;
  } catch (error) {
    throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Set a mock for a Tauri command
 * @param command - Command name to mock
 * @param config - Mock configuration
 */
export async function setMock(command: string, config: unknown): Promise<void> {
  try {
    const invoke = await getInvoke();
    await invoke('plugin:wdio|set-mock', {
      command,
      config,
    } as InvokeArgs);
  } catch (error) {
    throw new Error(`Failed to set mock for ${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get mock configuration for a command
 * @param command - Command name
 * @returns Mock configuration or null
 */
export async function getMock(command: string): Promise<unknown | null> {
  try {
    const invoke = await getInvoke();
    return await invoke('plugin:wdio|get-mock', { command } as InvokeArgs);
  } catch (error) {
    throw new Error(`Failed to get mock for ${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clear all mocks
 */
export async function clearMocks(): Promise<void> {
  try {
    const invoke = await getInvoke();
    await invoke('plugin:wdio|clear-mocks');
  } catch (error) {
    throw new Error(`Failed to clear mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reset all mocks
 */
export async function resetMocks(): Promise<void> {
  try {
    const invoke = await getInvoke();
    await invoke('plugin:wdio|reset-mocks');
  } catch (error) {
    throw new Error(`Failed to reset mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Restore all mocks
 */
export async function restoreMocks(): Promise<void> {
  try {
    const invoke = await getInvoke();
    await invoke('plugin:wdio|restore-mocks');
  } catch (error) {
    throw new Error(`Failed to restore mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper to log using Tauri's log plugin (will output to stdout in tests)
async function tauriLog(message: string): Promise<void> {
  try {
    // Try to use Tauri's log plugin if available
    if (typeof window !== 'undefined' && window.__TAURI__?.log?.info) {
      await window.__TAURI__.log.info(message);
    } else {
      // Fallback to console.log
      console.log(message);
    }
  } catch {
    // Silently fail if logging doesn't work
    console.log(message);
  }
}

/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export function init(): void {
  const messages: string[] = [];
  messages.push('[WDIO Tauri Plugin] Initializing...');
  messages.push(`[WDIO Tauri Plugin] typeof window: ${typeof window}`);

  if (typeof window === 'undefined') {
    messages.push('[WDIO Tauri Plugin] Window is undefined, skipping initialization');
    for (const msg of messages) {
      console.log(msg);
    }
    return;
  }

  messages.push(`[WDIO Tauri Plugin] window.__TAURI__ available: ${typeof window.__TAURI__ !== 'undefined'}`);
  messages.push(
    `[WDIO Tauri Plugin] window.__TAURI__?.core?.invoke available: ${typeof window.__TAURI__?.core?.invoke !== 'undefined'}`,
  );
  messages.push(`[WDIO Tauri Plugin] window.__TAURI__?.log available: ${typeof window.__TAURI__?.log !== 'undefined'}`);

  // Expose wdioTauri on window object for backward compatibility
  // Note: window.__TAURI__ might not be available immediately, but we can set up the API
  // The API functions will check for __TAURI__ when they're called
  window.wdioTauri = {
    execute,
    setMock,
    getMock,
    clearMocks,
    resetMocks,
    restoreMocks,
  };

  messages.push('[WDIO Tauri Plugin] window.wdioTauri set successfully');
  messages.push(`[WDIO Tauri Plugin] window.wdioTauri.execute: ${typeof window.wdioTauri.execute}`);

  // Log all messages (console.log is synchronous, will work immediately)
  for (const msg of messages) {
    console.log(msg);
  }

  // Also try to log via Tauri (async, will work after Tauri initializes)
  Promise.all(messages.map((msg) => tauriLog(msg))).catch(() => {
    // Ignore errors
  });
}

// Auto-initialize when imported
const initMessages: string[] = [];
initMessages.push('[WDIO Tauri Plugin] Module loaded, checking if should auto-initialize...');
initMessages.push(`[WDIO Tauri Plugin] typeof window at module level: ${typeof window}`);

if (typeof window !== 'undefined') {
  initMessages.push('[WDIO Tauri Plugin] Auto-initializing...');
  for (const msg of initMessages) {
    console.log(msg);
  }
  init();
} else {
  initMessages.push('[WDIO Tauri Plugin] Window not available at module level, skipping auto-init');
  for (const msg of initMessages) {
    console.log(msg);
  }
}
