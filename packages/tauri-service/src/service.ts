import type { TauriAPIs, TauriServiceAPI } from '@wdio/native-types';
import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { execute } from './commands/execute.js';
import { clearAllMocks, isMockFunction, mock, mockAll, resetAllMocks, restoreAllMocks } from './commands/mock.js';
import type { TauriCapabilities, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'service');

/**
 * Tauri worker service
 */
export default class TauriWorkerService {
  private browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;

  constructor(_options: TauriServiceOptions, _capabilities: TauriCapabilities) {
    log.debug('TauriWorkerService initialized');
  }

  /**
   * Initialize the service
   */
  async before(
    _capabilities: TauriCapabilities,
    _specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    log.debug('Initializing Tauri worker service');
    this.browser = browser;

    if (browser.isMultiremote) {
      const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
      log.info(`Initializing ${mrBrowser.instances.length} multiremote instances`);

      // Add Tauri API to the root multiremote object first
      this.addTauriApi(browser as unknown as WebdriverIO.Browser);

      // Add Tauri API to each instance and wait for readiness
      for (const instanceName of mrBrowser.instances) {
        const mrInstance = mrBrowser.getInstance(instanceName);
        log.debug(`Initializing instance: ${instanceName}`);
        this.addTauriApi(mrInstance);
        this.patchBrowserExecute(mrInstance);
        await waitUntilWindowAvailable(mrInstance);
        log.debug(`Instance ${instanceName} ready`);

        // Wait for plugin initialization on this instance
        log.debug(`Waiting for Tauri plugin initialization on ${instanceName}...`);
        try {
          await mrInstance.execute(async function checkMultiremotePluginInit() {
            // @ts-expect-error - window exists in browser context
            if (typeof window.wdioTauri !== 'undefined' && typeof window.wdioTauri.waitForInit === 'function') {
              // @ts-expect-error - window exists in browser context
              await window.wdioTauri.waitForInit();
              return true;
            }
            return false;
          });
          log.debug(`Tauri plugin initialization complete for ${instanceName}`);
        } catch (error) {
          log.warn(`Failed to wait for plugin initialization on ${instanceName}:`, error);
        }
      }
    } else {
      log.debug('Initializing standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      this.patchBrowserExecute(browser as WebdriverIO.Browser);
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Standard browser ready');
    }

    // Wait for the plugin to fully initialize (specifically attachConsole())
    // This ensures frontend console logs will be captured
    log.info('🔍 DEBUG: Waiting for Tauri plugin initialization...');
    try {
      const result = await (browser as WebdriverIO.Browser).execute(async function checkPluginInit() {
        const debug: string[] = [];
        // @ts-expect-error - window exists in browser context
        debug.push(`window.wdioTauri available: ${typeof window.wdioTauri !== 'undefined'}`);
        // @ts-expect-error - window exists in browser context
        if (typeof window.wdioTauri !== 'undefined') {
          // @ts-expect-error - window exists in browser context
          debug.push(`window.wdioTauri.waitForInit available: ${typeof window.wdioTauri.waitForInit === 'function'}`);
          // @ts-expect-error - window exists in browser context
          debug.push(`window.__TAURI__ available: ${typeof window.__TAURI__ !== 'undefined'}`);
          // @ts-expect-error - window exists in browser context
          debug.push(`window.__TAURI__?.log available: ${typeof window.__TAURI__?.log !== 'undefined'}`);
        }
        // @ts-expect-error - window exists in browser context
        if (typeof window.wdioTauri !== 'undefined' && typeof window.wdioTauri.waitForInit === 'function') {
          debug.push('Calling waitForInit...');
          // @ts-expect-error - window exists in browser context
          await window.wdioTauri.waitForInit();
          debug.push('waitForInit completed');
          return { success: true, debug };
        }
        return { success: false, debug };
      });
      log.info(`🔍 DEBUG: waitForInit result: ${JSON.stringify(result)}`);
      log.info('✅ Tauri plugin initialization complete');
    } catch (error) {
      log.error('❌ Failed to wait for plugin initialization:', error);
    }

    // Frontend log capture is handled automatically by the @wdio/tauri-plugin
    // The plugin calls attachConsole() during initialization to forward console logs
    // to the Tauri log plugin, which outputs to stdout for capture by the launcher

    // Initialize Tauri mocking system
    log.info('🔧 Initializing Tauri mocking system...');
    try {
      await (browser as WebdriverIO.Browser).execute(async function initMocks() {
        // @ts-expect-error - injection script will be bundled
        if (typeof window.initializeTauriMocks === 'function') {
          // @ts-expect-error - injection script will be bundled
          await window.initializeTauriMocks();
        }
      });
      log.info('✅ Tauri mocking system initialized');
    } catch (error) {
      log.warn('⚠️ Failed to initialize Tauri mocking system:', error);
      log.warn('   Mocking functionality may not be available');
    }
  }

  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    // Pre-test logic if needed
  }

  async afterTest(_test: unknown, _context: unknown, _results: unknown): Promise<void> {
    // Post-test logic if needed
  }

  async after(_results: unknown, _capabilities: TauriCapabilities, _specs: string[]): Promise<void> {
    // Cleanup if needed
  }

  /**
   * Clean up session after tests complete
   * This is critical for retry functionality - without explicit session deletion,
   * retries fail with "invalid session id" errors
   */
  async afterSession(_config: unknown, _capabilities: TauriCapabilities, _specs: string[]): Promise<void> {
    log.debug('Cleaning up session...');

    if (!this.browser) {
      log.warn('No browser instance available for session cleanup');
      return;
    }

    try {
      // Delete WebDriver session explicitly for clean retry handling
      if (!this.browser.isMultiremote) {
        const stdBrowser = this.browser as WebdriverIO.Browser;
        if (stdBrowser.sessionId) {
          log.debug(`Deleting session: ${stdBrowser.sessionId}`);
          await stdBrowser.deleteSession();
          log.debug('Session deleted successfully');
        }
      } else {
        // Handle multiremote cleanup
        const mrBrowser = this.browser as WebdriverIO.MultiRemoteBrowser;
        for (const instanceName of mrBrowser.instances) {
          try {
            const instance = mrBrowser.getInstance(instanceName);
            if (instance.sessionId) {
              log.debug(`Deleting session for instance ${instanceName}: ${instance.sessionId}`);
              await instance.deleteSession();
              log.debug(`Session deleted for instance ${instanceName}`);
            }
          } catch (error) {
            log.warn(`Failed to delete session for instance ${instanceName}:`, error);
          }
        }
      }
    } catch (error) {
      log.warn('Failed to delete session:', error);
      // Don't throw - allow cleanup to continue
    }
  }

  /**
   * Add Tauri API to browser object
   * Matches the Electron service API surface exactly
   */
  private addTauriApi(browser: WebdriverIO.Browser): void {
    (browser as WebdriverIO.Browser & { tauri: TauriServiceAPI }).tauri = this.getTauriAPI(browser);
  }

  /**
   * Get Tauri API object for a browser instance
   * Handles both standard and multiremote browsers
   */
  private getTauriAPI(browser: WebdriverIO.Browser): TauriServiceAPI {
    return {
      execute: <ReturnValue, InnerArguments extends unknown[]>(
        script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
        ...args: InnerArguments
      ): Promise<ReturnValue | undefined> => {
        return execute<ReturnValue, InnerArguments>(browser, script, ...args);
      },

      clearAllMocks: async (): Promise<void> => {
        return clearAllMocks.call({ browser });
      },

      isMockFunction: async (command: string): Promise<boolean> => {
        return isMockFunction.call({ browser }, command);
      },

      mock: async (command: string) => {
        return mock.call({ browser }, command);
      },

      mockAll: async (): Promise<void> => {
        return mockAll.call({ browser });
      },

      resetAllMocks: async (): Promise<void> => {
        return resetAllMocks.call({ browser });
      },

      restoreAllMocks: async (): Promise<void> => {
        return restoreAllMocks.call({ browser });
      },
    };
  }

  /**
   * Patch browser.execute() to automatically inject console forwarding code
   * This ensures console logs from browser.execute() contexts are captured
   */
  private patchBrowserExecute(browser: WebdriverIO.Browser): void {
    // Store the original execute method
    const originalExecute = browser.execute.bind(browser);

    // Override execute to inject console forwarding using Object.defineProperty
    // to handle readonly property
    const patchedExecute = async function patchedExecute<ReturnValue, InnerArguments extends unknown[]>(
      script: string | ((...args: InnerArguments) => ReturnValue),
      ...args: InnerArguments
    ): Promise<ReturnValue> {
      // Convert script to string if it's a function
      const scriptString = typeof script === 'function' ? script.toString() : script;

      // Wrap the script with console forwarding setup executed IN THE SAME CONTEXT
      // The forwarding code wraps console methods, then the test script runs with wrapped console
      const wrappedScript = `
        // Setup console forwarding first
        (function() {
          if (typeof window === 'undefined' || !window.__TAURI__ || !window.__TAURI__.core) {
            return;
          }

          // Store original console methods
          const originalConsole = {
            log: console.log.bind(console),
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
          };

          // Log level enum matching Tauri plugin-log
          const LogLevel = {
            Trace: 1,
            Debug: 2,
            Info: 3,
            Warn: 4,
            Error: 5
          };

          // Helper to forward to Tauri log plugin using invoke
          function forward(level, args) {
            const message = Array.from(args).map(function(arg) {
              return typeof arg === 'string' ? arg : JSON.stringify(arg);
            }).join(' ');

            // Call original console method
            const method = level === LogLevel.Trace ? 'log' :
                          level === LogLevel.Debug ? 'debug' :
                          level === LogLevel.Info ? 'info' :
                          level === LogLevel.Warn ? 'warn' : 'error';
            if (originalConsole[method]) {
              originalConsole[method](message);
            }

            // Forward to custom frontend logging command with target="frontend"
            // Using custom command instead of plugin:log|log to avoid target="webview" filtering issues
            if (window.__TAURI__.core.invoke) {
              // Map LogLevel enum to string
              const levelStr = level === LogLevel.Trace ? 'trace' :
                              level === LogLevel.Debug ? 'debug' :
                              level === LogLevel.Info ? 'info' :
                              level === LogLevel.Warn ? 'warn' : 'error';

              window.__TAURI__.core.invoke('log_frontend', {
                level: levelStr,
                message: message
              }).catch(function(err) {
                // Log error to original console for debugging
                originalConsole.error('[WDIO Console Forwarding] Failed to forward log:', err);
              });
            }
          }

          // Wrap console methods using Object.defineProperty (works on WebKit)
          try {
            Object.defineProperty(console, 'log', {
              value: function() { forward(LogLevel.Trace, arguments); },
              writable: true,
              configurable: true
            });
            Object.defineProperty(console, 'debug', {
              value: function() { forward(LogLevel.Debug, arguments); },
              writable: true,
              configurable: true
            });
            Object.defineProperty(console, 'info', {
              value: function() { forward(LogLevel.Info, arguments); },
              writable: true,
              configurable: true
            });
            Object.defineProperty(console, 'warn', {
              value: function() { forward(LogLevel.Warn, arguments); },
              writable: true,
              configurable: true
            });
            Object.defineProperty(console, 'error', {
              value: function() { forward(LogLevel.Error, arguments); },
              writable: true,
              configurable: true
            });
          } catch (err) {
            // If Object.defineProperty fails, console forwarding won't work
            originalConsole.warn('[WDIO Console Forwarding] Failed to override console methods:', err);
          }
        })();

        // Now execute the test script with wrapped console
        return (${scriptString}).apply(null, arguments);
      `;

      // Execute the wrapped script
      return originalExecute(wrappedScript, ...args) as Promise<ReturnValue>;
    };

    // Use Object.defineProperty to override readonly property
    Object.defineProperty(browser, 'execute', {
      value: patchedExecute,
      writable: true,
      configurable: true,
    });

    log.debug('Patched browser.execute() to auto-inject console forwarding');
  }
}
