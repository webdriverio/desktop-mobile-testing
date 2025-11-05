import type { TauriAPIs, TauriServiceAPI } from '@wdio/native-types';
import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { execute } from './commands/execute.js';
import type { TauriCapabilities, TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'service');

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
      }
    } else {
      log.debug('Initializing standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Standard browser ready');
    }
  }

  async beforeCommand(_commandName: string, _args: unknown[]): Promise<void> {
    // Pre-command logic if needed
  }

  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    // Pre-test logic if needed
  }

  async afterTest(_test: unknown, _context: unknown, _results: unknown): Promise<void> {
    // Post-test logic if needed
  }

  async after(): Promise<void> {
    // Cleanup logic if needed
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
