/**
 * WebDriverIO Tauri Plugin - Frontend TypeScript/JavaScript API
 * Provides execute and mocking interfaces for testing
 */

import type { InvokeArgs } from '@tauri-apps/api/core';
import * as nativeSpy from '@wdio/native-spy';

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
      event?: {
        listen?: (event: string, callback: (event: { payload: unknown }) => void) => Promise<() => void>;
        emit?: (event: string, payload: unknown) => Promise<void>;
      };
    };
    wdioTauri?: {
      execute: (script: string, ...args: unknown[]) => Promise<unknown>;
      waitForInit: () => Promise<void>;
      cleanupBackendLogListener?: () => void;
      cleanupFrontendLogListener?: () => void;
      cleanupInvokeInterception?: () => void;
      cleanupLogListeners: () => void;
      cleanupAll: () => void;
    };
    __wdio_spy__?: typeof nativeSpy;
    __wdio_mocks__?: Record<string, unknown>;
  }
}

/**
 * Cleanup registry to manage timers and event listeners
 * Prevents memory leaks from retry loops and orphaned listeners
 */
class CleanupRegistry {
  private timers = new Set<number>();
  private listeners = new Set<() => void>();

  addTimer(id: number): void {
    this.timers.add(id);
  }

  clearTimers(): void {
    this.timers.forEach((id) => {
      clearTimeout(id);
    });
    this.timers.clear();
  }

  addListener(fn: () => void): void {
    this.listeners.add(fn);
  }

  cleanup(): void {
    this.clearTimers();
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // Ignore cleanup errors
      }
    });
    this.listeners.clear();
  }
}

export const cleanupRegistry = new CleanupRegistry();

// Add page unload handler to cleanup automatically
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cleanupRegistry.cleanup();
  });
}

/**
 * Execute JavaScript code in the frontend context with access to Tauri APIs
 * The script will receive the Tauri APIs object as the first argument
 * @param script - JavaScript code to execute (function string without first parameter)
 * @param args - Arguments to pass to the script (after the Tauri APIs object)
 * @returns Result of the script execution
 */
export async function execute(script: string, ...args: unknown[]): Promise<unknown> {
  try {
    // Ensure window.__TAURI__ is available
    if (!window.__TAURI__) {
      throw new Error('window.__TAURI__ is not available. Make sure withGlobalTauri is enabled in tauri.conf.json');
    }

    // Serialize args to pass them to the plugin
    const argsJson = JSON.stringify(args);

    // Check if script is a function-like string that needs Tauri API injection
    // Function-like: starts with (, function, async, or single-param arrow like "x =>"
    // Non-function: expressions like "1 + 2 + 3", statements like "return 42"
    const trimmedScript = script.trim();
    const isFunctionLike =
      trimmedScript.startsWith('(') ||
      trimmedScript.startsWith('function') ||
      trimmedScript.startsWith('async') ||
      /^(\w+)\s*=>/.test(trimmedScript) ||
      (trimmedScript.startsWith('(') && trimmedScript.includes('=>'));

    // Wrap the script appropriately based on type
    let wrappedScript: string;

    if (isFunctionLike) {
      // Function-like script - wrap with Tauri API injection
      wrappedScript = `
        (async () => {
          const __wdio_tauri = window.__TAURI__;
          const __wdio_args = ${argsJson};

          // Wait for window.__TAURI__.core.invoke to be available
          if (!__wdio_tauri?.core?.invoke) {
            const startTime = Date.now();
            const timeout = 5000;
            while (!__wdio_tauri?.core?.invoke && (Date.now() - startTime) < timeout) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            if (!__wdio_tauri?.core?.invoke) {
              throw new Error('window.__TAURI__.core.invoke not available after 5s timeout');
            }
          }

          // Execute as function with Tauri APIs
          return await (${script})(__wdio_tauri, ...__wdio_args);
        })()
      `.trim();
    } else {
      // Expression/statement script - wrap with return for proper evaluation
      wrappedScript = `(async () => { return ${script}; })()`;
    }

    // Call the plugin command to execute the wrapped script
    // Tauri v2 plugin commands use format: plugin:plugin-name|command-name
    const invoke = await getInvoke();
    console.debug('[WDIO Plugin] Calling invoke with command: plugin:wdio|execute');
    try {
      const result = await invoke('plugin:wdio|execute', {
        request: {
          script: wrappedScript,
          args: [],
        },
      } as InvokeArgs);
      console.debug('[WDIO Plugin] Invoke result:', result);
      return result;
    } catch (error) {
      console.error('[WDIO Plugin] Invoke error:', error);
      throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// NOTE: Mock commands (setMock, getMock, clearMocks, resetMocks, restoreMocks) removed.
// Mocking is now JavaScript-only via window.__wdio_mocks__ and invoke interception.
// No backend Rust commands are needed for mocking - it's all handled in the frontend.

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

      // Helper to forward to Tauri log plugin
      // The log plugin outputs to stdout with target="frontend"
      function forward(level, args) {
        const message = Array.from(args).map(arg =>
          typeof arg === 'string' ? arg : JSON.stringify(arg)
        ).join(' ');

        // Call original console method
        originalConsole[level === 'trace' ? 'log' : level](message);

        // Forward to Tauri log plugin
        if (window.__TAURI__.log[level]) {
          window.__TAURI__.log[level](message).catch(() => {});
        }
      }

      // Wrap console methods using Object.defineProperty (works on WebKit)
      try {
        Object.defineProperty(console, 'log', {
          value: function() { forward('trace', arguments); },
          writable: true,
          configurable: true
        });
        Object.defineProperty(console, 'debug', {
          value: function() { forward('debug', arguments); },
          writable: true,
          configurable: true
        });
        Object.defineProperty(console, 'info', {
          value: function() { forward('info', arguments); },
          writable: true,
          configurable: true
        });
        Object.defineProperty(console, 'warn', {
          value: function() { forward('warn', arguments); },
          writable: true,
          configurable: true
        });
        Object.defineProperty(console, 'error', {
          value: function() { forward('error', arguments); },
          writable: true,
          configurable: true
        });
      } catch (err) {
        // If Object.defineProperty fails, console forwarding won't work
      }
    })();
  `;
}

/**
 * Forward console logs to Tauri log plugin or WDIO plugin's log_frontend command
 * This allows WebDriverIO to capture frontend console logs via the backend stdout
 */
function setupConsoleForwarding(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Helper function to safely forward to Tauri log plugin or WDIO plugin
  // Uses window.__TAURI__.log if available (requires tauri-plugin-log)
  // Falls back to WDIO plugin's log_frontend command (writes directly to stderr)
  async function forwardToTauri(level: 'trace' | 'debug' | 'info' | 'warn' | 'error', message: string): Promise<void> {
    try {
      // Try Tauri log plugin first
      if (window.__TAURI__?.log?.[level]) {
        await window.__TAURI__.log[level](message);
        return;
      }

      // Fallback to WDIO plugin's log_frontend command
      // This writes directly to stderr with [WDIO-FRONTEND] prefix
      if (window.__TAURI__?.core?.invoke) {
        await window.__TAURI__.core.invoke('plugin:wdio|log_frontend', {
          message,
          level,
        });
      }
    } catch {
      // Silently ignore if neither log plugin is available
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

  // Use Object.defineProperty to override console methods (works on WebKit)
  try {
    // Forward console.log to trace level
    Object.defineProperty(console, 'log', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.log(...args);
        forwardToTauri('trace', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });

    // Forward console.debug
    Object.defineProperty(console, 'debug', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.debug(...args);
        forwardToTauri('debug', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });

    // Forward console.info
    Object.defineProperty(console, 'info', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.info(...args);
        forwardToTauri('info', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });

    // Forward console.warn
    Object.defineProperty(console, 'warn', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.warn(...args);
        forwardToTauri('warn', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });

    // Forward console.error
    Object.defineProperty(console, 'error', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.error(...args);
        forwardToTauri('error', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });

    // Forward console.trace
    Object.defineProperty(console, 'trace', {
      value: (...args: unknown[]) => {
        const message = args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
        originalConsole.trace(...args);
        forwardToTauri('trace', message).catch(() => {
          // Ignore errors
        });
      },
      writable: true,
      configurable: true,
    });
  } catch (_error) {
    // If Object.defineProperty fails, console forwarding won't work
    // Console logs will still work but won't be forwarded to Tauri log plugin
  }
}

/**
 * Setup invoke interception for mocking
 * This wraps window.__TAURI__.core.invoke to check for mocks before calling the real implementation
 * Retries until window.__TAURI__.core.invoke is available (with timeout)
 */
function setupInvokeInterception(): void {
  if (typeof window === 'undefined') {
    console.warn('[WDIO Tauri Plugin] Cannot setup invoke interception - window not available');
    return;
  }

  let attempts = 0;
  const maxAttempts = 50; // 50 attempts * 100ms = 5 seconds max
  const retryInterval = 100; // ms

  const trySetup = () => {
    attempts++;

    // Check if window.__TAURI__.core is available and is an object
    const core = window.__TAURI__?.core;
    if (!core || typeof core !== 'object') {
      if (attempts < maxAttempts) {
        console.log(`[WDIO Tauri Plugin] Waiting for window.__TAURI__.core (attempt ${attempts}/${maxAttempts})`);
        const timerId = window.setTimeout(trySetup, retryInterval);
        cleanupRegistry.addTimer(timerId);
        return;
      } else {
        console.warn('[WDIO Tauri Plugin] Timeout waiting for window.__TAURI__.core - invoke interception not set up');
        return;
      }
    }

    // Check if we already have an invoke interceptor set up
    if ((core as { _wdioInvokeInterceptor?: boolean })._wdioInvokeInterceptor) {
      console.log('[WDIO Tauri Plugin] Invoke interception already set up');
      return;
    }

    // Get the original invoke function if it exists
    const originalInvoke =
      typeof (core as { invoke?: unknown }).invoke === 'function'
        ? (core as { invoke: (...args: unknown[]) => Promise<unknown> }).invoke.bind(core)
        : null;

    // Create a wrapped invoke function
    const wrappedInvoke = async (cmd: string, args?: InvokeArgs): Promise<unknown> => {
      // Check if there's a mock for this command
      const mockFn = window.__wdio_mocks__?.[cmd];

      if (mockFn && typeof mockFn === 'function') {
        console.log(`[WDIO Tauri Plugin] Intercepted invoke for '${cmd}' - using mock`);
        try {
          const result = await mockFn(args);
          return result;
        } catch (error) {
          console.error(`[WDIO Tauri Plugin] Mock error for '${cmd}':`, error);
          throw error;
        }
      }

      // No mock found, call the original invoke if available
      if (originalInvoke) {
        return originalInvoke(cmd, args);
      }

      // No original invoke, try to get it dynamically
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        return invoke(cmd, args);
      } catch (_error) {
        throw new Error(`Tauri API not available for command: ${cmd}`);
      }
    };

    // Use Object.defineProperty with a getter to ensure interception persists
    try {
      Object.defineProperty(core, 'invoke', {
        value: wrappedInvoke,
        writable: true,
        configurable: true,
      });
      (core as { _wdioInvokeInterceptor?: boolean })._wdioInvokeInterceptor = true;
      console.log('[WDIO Tauri Plugin] ✅ Invoke interception setup complete');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[WDIO Tauri Plugin] Failed to set up invoke interception:', errorMsg);
    }
  };

  trySetup();
}

/**
 * Setup event listener for backend logs
 * Backend emits 'backend-log' events that we forward to console for WebDriver capture
 * This bypasses tauri-driver's stdout limitation by routing through frontend console
 */
function setupBackendLogListener(): void {
  if (typeof window === 'undefined') {
    console.info('[WDIO][Frontend] setupBackendLogListener: window is undefined, skipping');
    return;
  }

  console.info('[WDIO][Frontend] Installing backend-log listener');

  const maxAttempts = 100;
  const retryInterval = 50;
  let attempts = 0;
  let removeListenerRef: (() => void) | null = null;

  const trySetup = () => {
    attempts++;

    if (attempts % 10 === 1) {
      console.info(`[WDIO][Frontend] Waiting for Tauri (attempt ${attempts}/${maxAttempts})`);
    }

    if (attempts >= maxAttempts) {
      console.warn('[WDIO][Frontend] Timeout waiting for Tauri - backend log listener not set up');
      return;
    }

    if (typeof window.__TAURI__ === 'undefined' || typeof window.__TAURI__.event === 'undefined') {
      const timerId = window.setTimeout(trySetup, retryInterval);
      cleanupRegistry.addTimer(timerId);
      return;
    }

    console.info('[WDIO][Frontend] Tauri ready - setting up backend-log listener');

    const setupListener = async () => {
      try {
        console.info('[WDIO][Frontend] Importing @tauri-apps/api/event');
        const { listen } = await import('@tauri-apps/api/event');
        console.info('[WDIO][Frontend] Event module imported successfully');

        const removeListener = await listen('backend-log', (event) => {
          console.info('[WDIO][Frontend] backend-log received:', event.payload);
          const logMessage = event.payload as string;
          console.info(logMessage);
        });

        removeListenerRef = removeListener;
        cleanupRegistry.addListener(removeListener);

        console.info('[WDIO][Frontend] Backend log listener registered successfully');

        if (!window.wdioTauri) {
          window.wdioTauri = {} as Window['wdioTauri'];
        }
        const wdioTauri = window.wdioTauri;
        if (!wdioTauri) {
          return;
        }
        wdioTauri.cleanupBackendLogListener = () => {
          if (removeListenerRef) {
            removeListenerRef();
            removeListenerRef = null;
          }
          console.log('[WDIO Tauri Plugin] Backend log listener cleaned up');
        };
      } catch (error) {
        console.log(`[WDIO Tauri Plugin] Failed to setup backend log listener: ${error}`);
      }
    };

    setupListener();
  };

  trySetup();
}

/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export async function init(): Promise<void> {
  if (isInitialized) {
    console.log('[WDIO Tauri Plugin] Already initialized, skipping');
    return;
  }

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
  // Mock commands are not exposed here - mocking is handled via window.__wdio_mocks__
  if (!window.wdioTauri) {
    window.wdioTauri = {} as Window['wdioTauri'];
  }
  const wdioTauriObj = window.wdioTauri as Window['wdioTauri'] & { execute: unknown; waitForInit: unknown };
  wdioTauriObj.execute = execute;
  wdioTauriObj.waitForInit = waitForInit;

  // Add cleanup functions
  wdioTauriObj.cleanupLogListeners = () => cleanupRegistry.cleanup();
  wdioTauriObj.cleanupInvokeInterception = () => {
    cleanupRegistry.clearTimers();
  };
  wdioTauriObj.cleanupAll = () => {
    wdioTauriObj.cleanupBackendLogListener?.();
    wdioTauriObj.cleanupFrontendLogListener?.();
    wdioTauriObj.cleanupInvokeInterception?.();
    cleanupRegistry.cleanup();
  };

  messages.push('[WDIO Tauri Plugin] window.wdioTauri set successfully');
  messages.push(
    `[WDIO Tauri Plugin] window.wdioTauri.execute: ${window.wdioTauri?.execute ? 'function' : 'undefined'}`,
  );

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

  // Setup event listener for backend logs
  // Backend emits 'backend-log' events that we forward to console for WebDriver capture
  console.log('[WDIO Tauri Plugin] Setting up backend log event listener...');
  setupBackendLogListener();
  console.log('[WDIO Tauri Plugin] ✅ Backend log listener initialized');

  // Expose native spy on window for mock creation
  window.__wdio_spy__ = nativeSpy;

  // Setup invoke interception for mocking support
  console.log('[WDIO Tauri Plugin] Setting up invoke interception for mocking...');
  setupInvokeInterception();

  // Log all accumulated messages now that forwarding is active
  for (const msg of messages) {
    console.log(msg);
  }

  // Test that console forwarding works
  console.info('[WDIO Tauri Plugin] TEST: This is a test INFO log after setupConsoleForwarding()');
  console.warn('[WDIO Tauri Plugin] TEST: This is a test WARN log after setupConsoleForwarding()');

  isInitialized = true;
}

// Auto-initialize when imported
// NOTE: We can't await at module level, but we start the initialization immediately
// and expose a promise that can be awaited by consumers if needed
let initPromise: Promise<void> | null = null;
let isInitialized = false;

if (typeof window !== 'undefined') {
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (!isInitialized) {
        initPromise = init();
      }
    });
  } else {
    if (!isInitialized) {
      initPromise = init();
    }
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
