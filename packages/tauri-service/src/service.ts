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
}
