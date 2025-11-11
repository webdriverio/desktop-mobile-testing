import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { execute } from './commands/execute.js';
import type { TauriCapabilities, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'service');
const browsersWithConsoleForwarding = new WeakSet<WebdriverIO.Browser>();

type TauriAPIs = {
  core: {
    invoke<ReturnValue = unknown>(command: string, args?: Record<string, unknown>): Promise<ReturnValue>;
  };
};

type TauriServiceAPI = {
  execute<ReturnValue, InnerArguments extends unknown[]>(
    script: string | ((tauri: TauriAPIs, ...args: InnerArguments) => ReturnValue),
    ...args: InnerArguments
  ): Promise<ReturnValue | undefined>;
  clearAllMocks(apiName?: string): Promise<void>;
  isMockFunction(fn: unknown): boolean;
  mock(apiName: string, funcName: string): Promise<unknown>;
  mockAll(apiName: string): Promise<unknown>;
  resetAllMocks(apiName?: string): Promise<void>;
  restoreAllMocks(apiName?: string): Promise<void>;
};

/**
 * Tauri worker service
 */
export default class TauriWorkerService {
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

    // Restore browserName to 'wry' for display purposes in test output
    // We removed it in onWorkerStart before session creation (tauri-driver doesn't accept it),
    // but now that the session is created, we can restore it for display in reporters
    if (browser.isMultiremote) {
      const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
      for (const instanceName of mrBrowser.instances) {
        const instance = mrBrowser.getInstance(instanceName);
        if (instance.capabilities && typeof instance.capabilities === 'object') {
          const displayName =
            (instance.capabilities as { 'wdio:displayBrowserName'?: string })['wdio:displayBrowserName'] ?? 'wry';
          (instance.capabilities as { browserName?: string }).browserName = displayName;
          log.debug(`Restored browserName='${displayName}' for multiremote instance: ${instanceName}`);
        }
      }
    } else {
      if (browser.capabilities && typeof browser.capabilities === 'object') {
        const displayName =
          (browser.capabilities as { 'wdio:displayBrowserName'?: string })['wdio:displayBrowserName'] ?? 'wry';
        (browser.capabilities as { browserName?: string }).browserName = displayName;
        log.debug(`Restored browserName='${displayName}' for standard browser`);
      }
    }

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
        await waitUntilWindowAvailable(mrInstance);
        log.debug(`Instance ${instanceName} ready`);
        await this.ensureConsoleForwarding(mrInstance);

        // Frontend log capture is now handled via attachConsole() in the Tauri app
        // Logs are forwarded to Rust stdout and captured by the launcher
      }
    } else {
      log.debug('Initializing standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Standard browser ready');
      await this.ensureConsoleForwarding(browser as WebdriverIO.Browser);

      // Frontend log capture is now handled via attachConsole() in the Tauri app
      // Logs are forwarded to Rust stdout and captured by the launcher
    }
  }

  async beforeCommand(
    _commandName: string,
    _args: unknown[],
    _browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    // Frontend log capture is now handled via attachConsole() in the Tauri app
    // Logs are forwarded to Rust stdout and captured by the launcher
  }

  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    // Pre-test logic if needed
  }

  async afterTest(_test: unknown, _context: unknown, _results: unknown): Promise<void> {
    // Post-test logic if needed
  }

  async after(): Promise<void> {
    // Cleanup if needed
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
        // TODO: Implement Tauri API mocking
      },

      isMockFunction: (_fn: unknown): boolean => {
        // TODO: Implement Tauri API mocking
        return false;
      },

      mock: async (_apiName: string, _funcName: string): Promise<unknown> => {
        // TODO: Implement Tauri API mocking
        return {};
      },

      mockAll: async (_apiName: string): Promise<unknown> => {
        // TODO: Implement Tauri API mocking
        return {};
      },

      resetAllMocks: async (_apiName?: string): Promise<void> => {
        // TODO: Implement Tauri API mocking
      },

      restoreAllMocks: async (_apiName?: string): Promise<void> => {
        // TODO: Implement Tauri API mocking
      },
    };
  }

  private async ensureConsoleForwarding(browser: WebdriverIO.Browser): Promise<void> {
    if (browsersWithConsoleForwarding.has(browser)) {
      return;
    }

    try {
      type ConsoleInjectionResult = {
        success: boolean;
        reason?: string;
        alreadyPatched?: boolean;
      };

      let lastResult: ConsoleInjectionResult | undefined;
      const result = await browser.waitUntil(
        async () => {
          lastResult = (await browser.execute(() => {
            const globalObj = globalThis as typeof globalThis & {
              __WDIO_TAURI_CONSOLE_PATCHED__?: boolean;
              __TAURI__?: {
                plugin?: {
                  log?: Partial<
                    Record<'trace' | 'debug' | 'info' | 'warn' | 'error', (message: string) => Promise<void>>
                  >;
                };
              };
            };

            if (globalObj.__WDIO_TAURI_CONSOLE_PATCHED__) {
              return { success: true, alreadyPatched: true };
            }

            const consoleObj = globalObj.console ?? console;
            const logPlugin = globalObj.__TAURI__?.plugin?.log;
            if (!logPlugin) {
              return { success: false, reason: 'log plugin not available' };
            }

            const levelMap = {
              trace: 'trace',
              debug: 'debug',
              info: 'info',
              warn: 'warn',
              error: 'error',
            } as const;

            const formatArgs = (args: unknown[]): string =>
              args
                .map((arg) => {
                  if (typeof arg === 'string') {
                    return arg;
                  }
                  if (arg instanceof Error) {
                    return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
                  }
                  try {
                    return JSON.stringify(arg);
                  } catch {
                    return String(arg);
                  }
                })
                .join(' ');

            (Object.keys(levelMap) as Array<keyof typeof levelMap>).forEach((level) => {
              const consoleMethod = levelMap[level];
              const original =
                typeof consoleObj[consoleMethod] === 'function'
                  ? consoleObj[consoleMethod].bind(consoleObj)
                  : () => undefined;
              const logger = logPlugin[level];
              if (typeof logger !== 'function') {
                consoleObj.warn?.('[WDIO][Tauri] Log plugin does not expose handler for level:', level);
                return;
              }
              consoleObj[consoleMethod] = ((...args: unknown[]) => {
                original(...args);
                const message = formatArgs(args);
                logger(message).catch((error: unknown) => {
                  consoleObj.warn?.('[WDIO][Tauri] Failed to forward console log via plugin:', error);
                });
              }) as (typeof consoleObj)[typeof consoleMethod];
            });

            globalObj.__WDIO_TAURI_CONSOLE_PATCHED__ = true;
            consoleObj.info?.('[WDIO][Tauri] Console forwarding enabled');
            return { success: true };
          })) as unknown as ConsoleInjectionResult;

          return lastResult?.success ?? false;
        },
        {
          timeout: 5000,
          interval: 250,
          timeoutMsg: 'Failed to inject console forwarding into Tauri webview within 5s',
        },
      );

      if (!result) {
        log.warn(
          `Failed to enable console forwarding: ${
            lastResult?.reason ?? 'unknown reason (log plugin may not be available)'
          }`,
        );
      } else if (lastResult?.alreadyPatched) {
        log.debug('Console forwarding already configured for this browser');
      } else {
        log.debug('Console forwarding successfully configured');
      }

      browsersWithConsoleForwarding.add(browser);
    } catch (error) {
      log.warn(`Error while configuring console forwarding: ${(error as Error).message}`);
    }
  }
}
