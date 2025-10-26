import { executeTauriCommand, isTauriApiAvailable } from './commands/execute.js';
import { createLogger } from './log.js';
import type { TauriCapabilities, TauriResult, TauriServiceOptions } from './types.js';

/**
 * Tauri API interface for browser object
 */
interface TauriAPI {
  execute: <T = unknown>(command: string, ...args: unknown[]) => Promise<TauriResult<T>>;
  isMockFunction: (fn: unknown) => boolean;
  mock: (apiName: string, funcName: string) => Promise<unknown>;
  mockAll: (apiName: string) => Promise<unknown>;
  clearAllMocks: () => Promise<void>;
  resetAllMocks: () => Promise<void>;
  restoreAllMocks: () => Promise<void>;
}

const log = createLogger('service');

/**
 * Tauri worker service
 */
export default class TauriWorkerService {
  constructor(options: TauriServiceOptions, capabilities: TauriCapabilities) {
    log.debug('TauriWorkerService initialized');
    log.debug('Options:', JSON.stringify(options, null, 2));
    log.debug('Capabilities:', JSON.stringify(capabilities, null, 2));
  }

  /**
   * Initialize the service
   */
  async before(
    _capabilities: TauriCapabilities,
    specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    log.debug('Initializing Tauri worker service...');
    log.debug('Specs:', specs);

    // Handle multiremote vs standard browser
    if (browser.isMultiremote) {
      const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;

      // Check Tauri API availability for each multiremote instance
      for (const instanceName of mrBrowser.instances) {
        const mrInstance = mrBrowser.getInstance(instanceName);
        const isAvailable = await isTauriApiAvailable(mrInstance);
        if (!isAvailable) {
          throw new Error(
            `Tauri API is not available for instance ${instanceName}. Make sure the Tauri app is running and tauri-driver is connected.`,
          );
        }

        // Add Tauri API to each multiremote instance
        this.addTauriApi(mrInstance);
      }
    } else {
      // Standard browser
      const isAvailable = await isTauriApiAvailable(browser as WebdriverIO.Browser);
      if (!isAvailable) {
        throw new Error(
          'Tauri API is not available. Make sure the Tauri app is running and tauri-driver is connected.',
        );
      }

      // Add Tauri API to browser object
      this.addTauriApi(browser as WebdriverIO.Browser);
    }

    log.debug('Tauri worker service initialized');
  }

  /**
   * Before command hook
   */
  async beforeCommand(commandName: string, _args: unknown[]): Promise<void> {
    log.debug(`Before command: ${commandName}`);
    // Add any pre-command logic here
  }

  /**
   * Before test hook
   */
  async beforeTest(_test: unknown, _context: unknown): Promise<void> {
    log.debug('Before test');
    // Add any pre-test logic here
  }

  /**
   * After test hook
   */
  async afterTest(_test: unknown, _context: unknown, _results: unknown): Promise<void> {
    log.debug('After test');
    // Add any post-test logic here
  }

  /**
   * Cleanup service
   */
  async after(): Promise<void> {
    log.debug('Cleaning up Tauri worker service...');
    // Add cleanup logic here
  }

  /**
   * Add Tauri API to browser object
   * Matches the Electron service API surface exactly
   */
  private addTauriApi(browser: WebdriverIO.Browser): void {
    // Extend browser object with Tauri API - matches Electron service exactly
    (browser as WebdriverIO.Browser & { tauri: TauriAPI }).tauri = {
      // Core execution - matches browser.electron.execute
      execute: <T = unknown>(command: string, ...args: unknown[]): Promise<TauriResult<T>> => {
        return executeTauriCommand<T>(browser, command, ...args);
      },

      // Mocking functionality - matches browser.electron.mock* methods
      clearAllMocks: async (): Promise<void> => {
        // TODO: Implement Tauri API mocking
        log.debug('clearAllMocks called - mocking not yet implemented');
      },

      isMockFunction: (_fn: unknown): boolean => {
        // TODO: Implement Tauri API mocking
        log.debug('isMockFunction called - mocking not yet implemented');
        return false;
      },

      mock: async (apiName: string, funcName: string): Promise<unknown> => {
        // TODO: Implement Tauri API mocking
        log.debug(`mock called for ${apiName}.${funcName} - mocking not yet implemented`);
        return {};
      },

      mockAll: async (apiName: string): Promise<unknown> => {
        // TODO: Implement Tauri API mocking
        log.debug(`mockAll called for ${apiName} - mocking not yet implemented`);
        return {};
      },

      resetAllMocks: async (apiName?: string): Promise<void> => {
        // TODO: Implement Tauri API mocking
        log.debug(`resetAllMocks called for ${apiName || 'all'} - mocking not yet implemented`);
      },

      restoreAllMocks: async (apiName?: string): Promise<void> => {
        // TODO: Implement Tauri API mocking
        log.debug(`restoreAllMocks called for ${apiName || 'all'} - mocking not yet implemented`);
      },
    };

    log.debug('Tauri API added to browser object');
  }
}
