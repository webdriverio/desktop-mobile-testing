import { createLogger } from '@wdio/native-utils';
import { remote } from 'webdriverio';
import TauriLaunchService from './launcher.js';
import TauriWorkerService from './service.js';
import type { TauriCapabilities, TauriServiceGlobalOptions } from './types.js';

const log = createLogger('tauri-service', 'service');

/**
 * Initialize Tauri service in standalone mode
 */
export async function init(
  capabilities: TauriCapabilities,
  globalOptions?: TauriServiceGlobalOptions,
): Promise<WebdriverIO.Browser> {
  log.debug('Initializing Tauri service in standalone mode...');

  const testRunnerOpts = globalOptions?.rootDir
    ? { rootDir: globalOptions.rootDir, capabilities: [] }
    : { capabilities: [] };
  const launcher = new TauriLaunchService(globalOptions || {}, capabilities, testRunnerOpts);

  // Prepare the service
  await launcher.onPrepare(testRunnerOpts, [capabilities]);

  // Start worker session
  await launcher.onWorkerStart('standalone', capabilities);

  log.debug('Tauri service capabilities after onPrepare:', JSON.stringify(capabilities, null, 2));

  // Extract connection info from capabilities (set by launcher.onPrepare)
  const hostname = (capabilities as { hostname?: string }).hostname || 'localhost';
  const port = (capabilities as { port?: number }).port || 4444;

  // Remove hostname and port from capabilities - they are not valid W3C WebDriver capabilities
  // They should only be at the top level of remote() options
  delete (capabilities as { hostname?: string }).hostname;
  delete (capabilities as { port?: number }).port;

  log.debug(
    `Connection info for remote(): hostname=${hostname}, port=${port}, ` +
      `browserName=${(capabilities as { browserName?: string }).browserName}`,
  );

  // Create worker service
  const service = new TauriWorkerService(capabilities['wdio:tauriServiceOptions'] || {}, capabilities);

  // Initialize session - connection info must be at top level, not in capabilities
  const browser = await remote({
    hostname,
    port,
    capabilities,
  });

  // Initialize the service
  await service.before(capabilities, [], browser);

  log.debug('Tauri standalone session initialized');
  return browser;
}

/**
 * Create Tauri capabilities
 */
export function createTauriCapabilities(
  appBinaryPath: string,
  options: {
    appArgs?: string[];
    tauriDriverPort?: number;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    commandTimeout?: number;
    startTimeout?: number;
  } = {},
): TauriCapabilities {
  return {
    browserName: 'tauri',
    'tauri:options': {
      application: appBinaryPath,
      args: options.appArgs || [],
    },
    'wdio:tauriServiceOptions': {
      appBinaryPath,
      appArgs: options.appArgs || [],
      tauriDriverPort: options.tauriDriverPort || 4444,
      logLevel: options.logLevel || 'info',
      commandTimeout: options.commandTimeout || 30000,
      startTimeout: options.startTimeout || 30000,
    },
  };
}

/**
 * Get Tauri service status
 */
export function getTauriServiceStatus(): {
  available: boolean;
  version?: string;
} {
  try {
    // This would be implemented to check if the service is available
    return {
      available: true,
      version: '0.0.0',
    };
  } catch {
    return {
      available: false,
    };
  }
}
