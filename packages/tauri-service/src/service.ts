import type { TauriAPIs, TauriServiceAPI } from '@wdio/native-types';
import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { execute } from './commands/execute.js';
import { captureFrontendLogs, setupPeriodicLogCapture } from './frontendLogCapture.js';
import type { LogLevel } from './logForwarder.js';
import type { TauriCapabilities, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'service');

/**
 * Tauri worker service
 */
export default class TauriWorkerService {
  private cleanupFunctions: Map<string | WebdriverIO.Browser, () => void> = new Map();
  private options: TauriServiceOptions;

  constructor(options: TauriServiceOptions, _capabilities: TauriCapabilities) {
    this.options = options;
    log.debug('TauriWorkerService initialized');
  }

  /**
   * Initialize the service
   */
  async before(
    capabilities: TauriCapabilities,
    _specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    log.debug('Initializing Tauri worker service');

    // Get options from capabilities (may override constructor options)
    const effectiveOptions = {
      ...this.options,
      ...capabilities['wdio:tauriServiceOptions'],
    };

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

        // Set up frontend log capture for this instance if enabled
        if (effectiveOptions.captureFrontendLogs) {
          const instanceOptions = {
            ...effectiveOptions,
            ...(mrInstance.capabilities as TauriCapabilities)?.['wdio:tauriServiceOptions'],
          };
          const minLevel = (instanceOptions.frontendLogLevel ?? 'info') as LogLevel;
          const cleanup = setupPeriodicLogCapture(mrInstance, minLevel, 1000, instanceName);
          this.cleanupFunctions.set(instanceName, cleanup);
        }
      }
    } else {
      log.debug('Initializing standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Standard browser ready');

      // Set up frontend log capture if enabled
      if (effectiveOptions.captureFrontendLogs) {
        const minLevel = (effectiveOptions.frontendLogLevel ?? 'info') as LogLevel;
        const cleanup = setupPeriodicLogCapture(browser as WebdriverIO.Browser, minLevel, 1000);
        this.cleanupFunctions.set(browser as WebdriverIO.Browser, cleanup);
      }
    }
  }

  async beforeCommand(
    _commandName: string,
    _args: unknown[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    // Capture frontend logs before command if enabled
    // This ensures we capture logs that might be cleared during command execution
    if (this.options.captureFrontendLogs) {
      if (browser.isMultiremote) {
        const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
        for (const instanceName of mrBrowser.instances) {
          const instance = mrBrowser.getInstance(instanceName);
          const instanceOptions = {
            ...this.options,
            ...(instance.capabilities as TauriCapabilities)?.['wdio:tauriServiceOptions'],
          };
          const minLevel = (instanceOptions.frontendLogLevel ?? 'info') as LogLevel;
          await captureFrontendLogs(instance, minLevel, instanceName).catch(() => {
            // Ignore errors - getLogs may not be supported
          });
        }
      } else {
        const minLevel = (this.options.frontendLogLevel ?? 'info') as LogLevel;
        await captureFrontendLogs(browser as WebdriverIO.Browser, minLevel).catch(() => {
          // Ignore errors - getLogs may not be supported
        });
      }
    }
  }

  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    // Pre-test logic if needed
  }

  async afterTest(_test: unknown, _context: unknown, _results: unknown): Promise<void> {
    // Post-test logic if needed
  }

  async after(): Promise<void> {
    // Cleanup frontend log capture intervals
    for (const cleanup of this.cleanupFunctions.values()) {
      cleanup();
    }
    this.cleanupFunctions.clear();
  }

  /**
   * Add Tauri API to browser object
   * Matches the Electron service API surface exactly
   */
  private addTauriApi(browser: WebdriverIO.Browser): void {
    browser.tauri = this.getTauriAPI(browser);
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
}
