import type { TauriAPIs, TauriServiceAPI } from '@wdio/native-types';
import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { execute } from './commands/execute.js';
import { clearAllMocks, isMockFunction, mock, resetAllMocks, restoreAllMocks } from './commands/mock.js';
import { triggerDeeplink } from './commands/triggerDeeplink.js';
import mockStore from './mockStore.js';
import { CONSOLE_WRAPPER_SCRIPT } from './scripts/console-wrapper.js';
import type { TauriCapabilities, TauriServiceGlobalOptions, TauriServiceOptions } from './types.js';
import { clearWindowState, ensureActiveWindowFocus } from './window.js';

const log = createLogger('tauri-service', 'service');

const EXECUTE_PATCHED = Symbol('wdio-tauri-execute-patched');

/**
 * Tauri worker service
 */
type ElementCommands = 'click' | 'doubleClick' | 'setValue' | 'clearValue';

export default class TauriWorkerService {
  private browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
  private clearMocks: boolean;
  private clearMocksPrefix?: string;
  private resetMocks: boolean;
  private resetMocksPrefix?: string;
  private restoreMocks: boolean;
  private restoreMocksPrefix?: string;
  private driverProvider?: 'official' | 'crabnebula' | 'embedded';

  constructor(options: TauriServiceOptions & TauriServiceGlobalOptions, _capabilities: TauriCapabilities) {
    this.clearMocks = options.clearMocks ?? false;
    this.clearMocksPrefix = options.clearMocksPrefix;
    this.resetMocks = options.resetMocks ?? false;
    this.resetMocksPrefix = options.resetMocksPrefix;
    this.restoreMocks = options.restoreMocks ?? false;
    this.restoreMocksPrefix = options.restoreMocksPrefix;
    this.driverProvider = options.driverProvider;
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
        // Skip for CrabNebula - browser.execute() not supported
        if (this.driverProvider !== 'crabnebula') {
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
    // Skip for CrabNebula - browser.execute() not supported
    if (this.driverProvider !== 'crabnebula') {
      log.debug('Waiting for Tauri plugin initialization...');
      try {
        await (browser as WebdriverIO.Browser).execute(async function checkPluginInit() {
          // @ts-expect-error - window exists in browser context
          if (typeof window.wdioTauri !== 'undefined' && typeof window.wdioTauri.waitForInit === 'function') {
            // @ts-expect-error - window exists in browser context
            await window.wdioTauri.waitForInit();
          }
        });
        log.debug('Tauri plugin initialization complete');
      } catch (error) {
        log.error('Failed to wait for plugin initialization — tauri.execute() and mocking may not work:', error);
      }
    }

    // Frontend log capture is handled automatically by the @wdio/tauri-plugin
    // The plugin calls attachConsole() during initialization to forward console logs
    // to the Tauri log plugin, which outputs to stdout for capture by the launcher

    // In embedded mode the Tauri app process persists between WDIO runs, so
    // window.__wdio_mocks__ can carry stale state from a previous run into a
    // fresh session. Reset it here so every session starts clean.
    if (this.driverProvider === 'embedded') {
      try {
        if (browser.isMultiremote) {
          const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
          for (const instanceName of mrBrowser.instances) {
            const mrInstance = mrBrowser.getInstance(instanceName);
            await mrInstance.execute(function clearStaleMocks() {
              // @ts-expect-error - window is available in browser context
              if (window.__wdio_mocks__) window.__wdio_mocks__ = {};
            });
          }
        } else {
          await (browser as WebdriverIO.Browser).execute(function clearStaleMocks() {
            // @ts-expect-error - window is available in browser context
            if (window.__wdio_mocks__) window.__wdio_mocks__ = {};
          });
        }
        log.debug('Cleared stale mocks at session start');
      } catch (error) {
        log.warn('Failed to clear stale mocks at session start:', error);
      }
    }

    // Install command overrides to trigger mock updates after DOM interactions
    this.installCommandOverrides();
  }

  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    if (this.clearMocks) {
      await clearAllMocks.call({ browser: this.browser }, this.clearMocksPrefix);
    }
    if (this.resetMocks) {
      await resetAllMocks.call({ browser: this.browser }, this.resetMocksPrefix);
    }
    if (this.restoreMocks) {
      await restoreAllMocks.call({ browser: this.browser }, this.restoreMocksPrefix);
    }
  }

  async beforeCommand(commandName: string, _args: unknown[]): Promise<void> {
    if (!this.browser || this.browser.isMultiremote) {
      return;
    }

    const browser = this.browser as WebdriverIO.Browser;

    try {
      // Generic window focus detection like Electron - no app-specific knowledge
      await ensureActiveWindowFocus(browser, commandName);
    } catch (error) {
      log.warn('Failed to ensure window focus before command:', error);
    }
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

    // Restore and clear mocks to prevent memory leaks
    try {
      if (this.browser) {
        await restoreAllMocks.call({ browser: this.browser });
      }
      mockStore.clear();
      log.debug('Mock store cleared');
    } catch (error) {
      log.warn('Failed to clear mock store:', error);
    }

    if (!this.browser) {
      log.warn('No browser instance available for session cleanup');
      clearWindowState();
      return;
    }

    try {
      // Delete WebDriver session explicitly for clean retry handling
      if (!this.browser.isMultiremote) {
        const stdBrowser = this.browser as WebdriverIO.Browser;
        clearWindowState(stdBrowser.sessionId);
        if (stdBrowser.sessionId) {
          log.debug(`Deleting session: ${stdBrowser.sessionId}`);
          await stdBrowser.deleteSession();
          log.debug('Session deleted successfully');
        }
      } else {
        // Handle multiremote cleanup
        const mrBrowser = this.browser as WebdriverIO.MultiRemoteBrowser;
        const sessionIds: (string | undefined)[] = [];
        for (const instanceName of mrBrowser.instances) {
          try {
            const instance = mrBrowser.getInstance(instanceName);
            sessionIds.push(instance.sessionId);
            if (instance.sessionId) {
              log.debug(`Deleting session for instance ${instanceName}: ${instance.sessionId}`);
              await instance.deleteSession();
              log.debug(`Session deleted for instance ${instanceName}`);
            }
          } catch (error) {
            log.warn(`Failed to delete session for instance ${instanceName}:`, error);
          }
        }
        // Clear all session IDs from cache
        for (const sid of sessionIds) {
          clearWindowState(sid);
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
      execute: async <ReturnValue, InnerArguments extends unknown[]>(
        script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
        ...args: InnerArguments
      ): Promise<ReturnValue> => {
        const result = await execute<ReturnValue, InnerArguments>(browser, script, ...args);
        await updateAllMocks();
        return result;
      },

      clearAllMocks: async (commandPrefix?: string): Promise<void> => {
        return clearAllMocks.call({ browser }, commandPrefix);
      },

      isMockFunction: (commandOrFn: unknown) => {
        if (typeof commandOrFn === 'string') {
          try {
            mockStore.getMock(`tauri.${commandOrFn}`);
            return true;
          } catch {
            return false;
          }
        }
        return isMockFunction(commandOrFn);
      },

      mock: async (command: string) => {
        return mock.call({ browser }, command);
      },

      resetAllMocks: async (commandPrefix?: string): Promise<void> => {
        return resetAllMocks.call({ browser }, commandPrefix);
      },

      restoreAllMocks: async (commandPrefix?: string): Promise<void> => {
        return restoreAllMocks.call({ browser }, commandPrefix);
      },

      triggerDeeplink: async (url: string): Promise<void> => {
        return triggerDeeplink.call({ browser }, url);
      },
    };
  }

  /**
   * Install command overrides to trigger mock updates after DOM interactions
   */
  private installCommandOverrides() {
    const commandsToOverride: ElementCommands[] = ['click', 'doubleClick', 'setValue', 'clearValue'];
    commandsToOverride.forEach((commandName) => {
      this.overrideElementCommand(commandName);
    });
  }

  /**
   * Override an element-level command to add mock update after execution
   */
  private overrideElementCommand(commandName: ElementCommands) {
    const browser = this.browser as WebdriverIO.Browser;
    try {
      const testOverride = async function (
        this: WebdriverIO.Element,
        originalCommand: (...args: readonly unknown[]) => Promise<unknown>,
        ...args: readonly unknown[]
      ): Promise<unknown> {
        const result = await Reflect.apply(originalCommand, this, args as unknown[]);
        await updateAllMocks();
        return result;
      } as Parameters<typeof browser.overwriteCommand>[1];

      browser.overwriteCommand(commandName, testOverride, true);
    } catch (error) {
      log.warn(`Failed to override element command '${commandName}':`, error);
    }
  }

  /**
   * Patch browser.execute() to automatically inject console forwarding code
   * This ensures console logs from browser.execute() contexts are captured
   */
  private patchBrowserExecute(browser: WebdriverIO.Browser): void {
    interface PatchedBrowser extends WebdriverIO.Browser {
      [EXECUTE_PATCHED]?: boolean;
    }
    const patchedBrowser = browser as PatchedBrowser;
    if (patchedBrowser[EXECUTE_PATCHED]) {
      log.debug('browser.execute already patched, skipping');
      return;
    }

    const originalExecute = browser.execute.bind(browser);
    const isEmbedded = this.driverProvider === 'embedded';

    const patchedExecute = async function patchedExecute<ReturnValue, InnerArguments extends unknown[]>(
      script: string | ((...args: InnerArguments) => ReturnValue),
      ...args: InnerArguments
    ): Promise<ReturnValue> {
      const scriptString = typeof script === 'function' ? script.toString() : script;

      if (isEmbedded) {
        // For embedded WebDriver: skip console wrapper as console forwarding
        // is handled by tauri-plugin-webdriver.
        return originalExecute(scriptString, ...args) as Promise<ReturnValue>;
      }

      // For tauri-driver: use sync execute with console wrapper
      const wrappedScript = `
            ${CONSOLE_WRAPPER_SCRIPT}
            return (${scriptString}).apply(null, arguments);
          `;

      return originalExecute(wrappedScript, ...args) as Promise<ReturnValue>;
    };

    Object.defineProperty(browser, 'execute', {
      value: patchedExecute,
      writable: true,
      configurable: true,
    });

    patchedBrowser[EXECUTE_PATCHED] = true;
    log.debug('browser.execute() patched with console forwarding');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Update all existing mocks by syncing inner (browser) mock state to outer (test) mocks.
 * On Windows, updates run sequentially to avoid saturating WebView2 with concurrent
 * ExecuteScript calls. Each update is retried once (after 50 ms) before failing hard.
 * Silent swallow of mock-update errors leads to empty mock.calls assertions, which is
 * harder to diagnose than an explicit AggregateError.
 */
async function updateAllMocks(): Promise<void> {
  const mocks = mockStore.getMocks();
  if (mocks.length === 0) {
    return;
  }

  const tryUpdate = async (
    mockId: string,
    mockInstance: ReturnType<typeof mockStore.getMocks>[0][1],
  ): Promise<void> => {
    try {
      await mockInstance.update();
    } catch (firstError) {
      log.debug(`Mock update failed for ${mockId}, retrying in 50ms:`, firstError);
      await sleep(50);
      await mockInstance.update();
    }
  };

  if (process.platform === 'win32') {
    const errors: Array<{ mockId: string; error: unknown }> = [];
    for (const [mockId, mockInstance] of mocks) {
      try {
        await tryUpdate(mockId, mockInstance);
      } catch (error) {
        errors.push({ mockId, error });
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors.map((e) => e.error),
        `Mock updates failed for: ${errors.map((e) => e.mockId).join(', ')}`,
      );
    }
  } else {
    const results = await Promise.allSettled(mocks.map(([mockId, mockInstance]) => tryUpdate(mockId, mockInstance)));
    const failures = results
      .map((result, i) => ({ result, mockId: mocks[i][0] }))
      .filter(
        (entry): entry is { result: PromiseRejectedResult; mockId: string } => entry.result.status === 'rejected',
      );
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((f) => f.result.reason),
        `Mock updates failed for: ${failures.map((f) => f.mockId).join(', ')}`,
      );
    }
  }
}
