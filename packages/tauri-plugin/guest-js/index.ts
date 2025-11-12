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
        trace?: (message: string) => Promise<void>;
        debug?: (message: string) => Promise<void>;
        info?: (message: string) => Promise<void>;
        warn?: (message: string) => Promise<void>;
        error?: (message: string) => Promise<void>;
      };
    };
    wdioTauri?: {
      execute: (script: string, args?: unknown[]) => Promise<unknown>;
      setMock: (command: string, config: unknown) => Promise<void>;
      getMock: (command: string) => Promise<unknown | null>;
      clearMocks: () => Promise<void>;
      resetMocks: () => Promise<void>;
      restoreMocks: () => Promise<void>;
      waitForInit: () => Promise<void>;
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

/**
 * Get the console forwarding setup code as a string
 * This can be injected into browser.execute() contexts
 */
export function getConsoleForwardingCode(): string {
  return `
    // Setup console forwarding to Tauri log plugin
    (function() {
      if (typeof window === 'undefined' || !window.__TAURI__?.log) {
        return;
      }

      // Store original methods
      const originalConsole = {
        log: console.log.bind(console),
        debug: console.debug.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
      };

      // Helper to forward to Tauri
      function forward(level, args) {
        const message = Array.from(args).map(arg =>
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');

        // Call original console method
        originalConsole[level === 'trace' ? 'log' : level](message);

        // Forward to Tauri log plugin
        if (window.__TAURI__?.log?.[level]) {
          window.__TAURI__.log[level](message).catch(() => {});
        }
      }

      // Wrap console methods
      console.log = function() { forward('trace', arguments); };
      console.debug = function() { forward('debug', arguments); };
      console.info = function() { forward('info', arguments); };
      console.warn = function() { forward('warn', arguments); };
      console.error = function() { forward('error', arguments); };
    })();
  `;
}

/**
 * Forward console logs to Tauri log plugin
 * This allows WebDriverIO to capture frontend console logs via the backend stdout
 */
function setupConsoleForwarding(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Helper function to safely forward to Tauri log plugin
  async function forwardToTauri(level: 'trace' | 'debug' | 'info' | 'warn' | 'error', message: string): Promise<void> {
    try {
      // Check if Tauri log plugin is available
      if (window.__TAURI__?.log?.[level]) {
        await window.__TAURI__.log[level](message);
      }
    } catch {
      // Silently ignore if log plugin not available
    }
  }

  // Store original console methods
  const originalConsole = {
    log: console.log,
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
    trace: console.trace,
  };

  // Forward console.log to trace level
  console.log = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.log(...args);
    forwardToTauri('trace', message).catch(() => {
      // Ignore errors
    });
  };

  // Forward console.debug
  console.debug = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.debug(...args);
    forwardToTauri('debug', message).catch(() => {
      // Ignore errors
    });
  };

  // Forward console.info
  console.info = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.info(...args);
    forwardToTauri('info', message).catch(() => {
      // Ignore errors
    });
  };

  // Forward console.warn
  console.warn = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.warn(...args);
    forwardToTauri('warn', message).catch(() => {
      // Ignore errors
    });
  };

  // Forward console.error
  console.error = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.error(...args);
    forwardToTauri('error', message).catch(() => {
      // Ignore errors
    });
  };

  // Forward console.trace
  console.trace = (...args: unknown[]) => {
    const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
    originalConsole.trace(...args);
    forwardToTauri('trace', message).catch(() => {
      // Ignore errors
    });
  };
}

/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export async function init(): Promise<void> {
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
    waitForInit,
  };

  messages.push('[WDIO Tauri Plugin] window.wdioTauri set successfully');
  messages.push(`[WDIO Tauri Plugin] window.wdioTauri.execute: ${typeof window.wdioTauri.execute}`);

  // Log all messages (console.log is synchronous, will work immediately)
  for (const msg of messages) {
    console.log(msg);
  }

  // Use manual console forwarding instead of attachConsole()
  // This is required for WebDriver testing where console logs are executed
  // dynamically via browser.execute() contexts. The native attachConsole()
  // from @tauri-apps/plugin-log only captures logs from the static page context.
  console.log('[WDIO Tauri Plugin] Setting up manual console forwarding for WebDriver compatibility');
  setupConsoleForwarding();
  console.log('[WDIO Tauri Plugin] ✅ Console forwarding initialized');

  // Log all accumulated messages now that forwarding is active
  for (const msg of messages) {
    console.log(msg);
  }

  // Test that console forwarding works
  console.info('[WDIO Tauri Plugin] TEST: This is a test INFO log after setupConsoleForwarding()');
  console.warn('[WDIO Tauri Plugin] TEST: This is a test WARN log after setupConsoleForwarding()');
}

// Auto-initialize when imported
// Note: We can't await at module level, but we start the initialization immediately
// and expose a promise that can be awaited by consumers if needed
const initMessages: string[] = [];
initMessages.push('[WDIO Tauri Plugin] Module loaded, checking if should auto-initialize...');
initMessages.push(`[WDIO Tauri Plugin] typeof window at module level: ${typeof window}`);

let initPromise: Promise<void> | null = null;

if (typeof window !== 'undefined') {
  initMessages.push('[WDIO Tauri Plugin] Auto-initializing...');
  for (const msg of initMessages) {
    console.log(msg);
  }
  // Start initialization immediately, store the promise
  initPromise = init();
} else {
  initMessages.push('[WDIO Tauri Plugin] Window not available at module level, skipping auto-init');
  for (const msg of initMessages) {
    console.log(msg);
  }
}

/**
 * Wait for plugin initialization to complete
 * This can be called by the service to ensure attachConsole() has completed
 */
export async function waitForInit(): Promise<void> {
  if (initPromise) {
    await initPromise;
  }
}
