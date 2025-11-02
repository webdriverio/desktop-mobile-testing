import { createLogger, waitUntilWindowAvailable } from '@wdio/native-utils';
import { executeTauriCommand } from './commands/execute.js';
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

const log = createLogger('tauri-service', 'service');

/**
 * Tauri worker service
 */
export default class TauriWorkerService {
  constructor(options: TauriServiceOptions, capabilities: TauriCapabilities) {
    log.info('🚀 TauriWorkerService constructor called');
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
    log.info('🚀 TauriWorkerService before() method called');
    log.debug('Initializing Tauri worker service...');
    log.debug('Specs:', specs);

    // Handle multiremote vs standard browser
    if (browser.isMultiremote) {
      const mrBrowser = browser as WebdriverIO.MultiRemoteBrowser;
      log.debug(`Initializing ${mrBrowser.instances.length} multiremote instances`);

      // Add Tauri API to the root multiremote object first (for browserA.tauri, browserB.tauri access)
      // Mirror Electron service approach: add API immediately without session validation
      this.addTauriApi(browser as unknown as WebdriverIO.Browser);
      log.debug('Tauri API added to root multiremote object');

      // Add Tauri API to each individual multiremote instance and wait for readiness
      // Process sequentially with delays to avoid session conflicts
      for (let i = 0; i < mrBrowser.instances.length; i++) {
        const instanceName = mrBrowser.instances[i];
        const mrInstance = mrBrowser.getInstance(instanceName);
        const sessionId = (mrInstance as any).sessionId || 'unknown';

        log.debug(`Processing instance ${instanceName} (session: ${sessionId.substring(0, 8)}...)`);

        // Add Tauri API to each individual multiremote instance
        this.addTauriApi(mrInstance);
        log.debug(`Tauri API added to instance: ${instanceName}`);

        // Wait until a window is available (shared util in native-utils)
        // This includes retry logic for transient "invalid session id" errors
        // Mirror Electron service: just wait, don't validate sessions before/after
        await waitUntilWindowAvailable(mrInstance);
        log.debug(`Tauri app ready for instance: ${instanceName}`);

        // Small delay between instances to prevent race conditions
        // where checking one instance might affect another
        if (i < mrBrowser.instances.length - 1) {
          log.debug('Waiting 200ms before processing next instance...');
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } else {
      // Standard browser
      log.debug('Adding Tauri API to standard browser');
      this.addTauriApi(browser as WebdriverIO.Browser);
      log.debug('Tauri API added to standard browser');

      // Wait until a window is available (shared util in native-utils)
      await waitUntilWindowAvailable(browser as WebdriverIO.Browser);
      log.debug('Tauri app ready for standard browser');
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

  // readiness handled via shared waitUntilWindowAvailable

  /**
   * Add Tauri API to browser object
   * Matches the Electron service API surface exactly
   */
  private addTauriApi(browser: WebdriverIO.Browser): void {
    // Extend browser object with Tauri API - matches Electron service exactly
    (browser as WebdriverIO.Browser & { tauri: TauriAPI }).tauri = this.getTauriAPI(browser);
    log.debug('Tauri API added to browser object');
  }

  /**
   * Get Tauri API object for a browser instance
   * Handles both standard and multiremote browsers
   */
  private getTauriAPI(browser: WebdriverIO.Browser): TauriAPI {
    return {
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
  }
}
