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
   * Remove browserName just before session creation
   * This hook runs right before the webdriver session is initialized,
   * so we can ensure browserName is removed before it's sent to tauri-driver
   */
  async beforeSession(
    _config: WebdriverIO.HookFunctionExtension,
    capabilities: TauriCapabilities | TauriCapabilities[] | Record<string, { capabilities: TauriCapabilities }>,
    _specs: string[],
  ): Promise<void> {
    log.debug('beforeSession: Removing browserName before session creation');

    // Handle both standard array and multiremote object capabilities
    const capsList = Array.isArray(capabilities)
      ? capabilities
      : Object.values(capabilities as Record<string, { capabilities: TauriCapabilities }>).map(
          (multiremoteOption) => multiremoteOption.capabilities,
        );

    for (const cap of capsList) {
      // Remove browserName right before session creation - tauri-driver doesn't accept it
      delete (cap as { browserName?: string }).browserName;
      log.debug('Removed browserName from capabilities in beforeSession hook');
    }
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
          (instance.capabilities as { browserName?: string }).browserName = 'wry';
          log.debug(`Restored browserName='wry' for multiremote instance: ${instanceName}`);
        }
      }
    } else {
      if (browser.capabilities && typeof browser.capabilities === 'object') {
        (browser.capabilities as { browserName?: string }).browserName = 'wry';
        log.debug("Restored browserName='wry' for standard browser");
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

        // Frontend log capture is now handled via attachConsole() in the Tauri app
        // Logs are forwarded to Rust stdout and captured by the launcher
      }
    } else {
      log.debug('Initializing standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Standard browser ready');

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
