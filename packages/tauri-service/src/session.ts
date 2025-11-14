import { createLogger } from '@wdio/native-utils';
import type { Options } from '@wdio/types';
import { remote } from 'webdriverio';
import TauriLaunchService from './launcher.js';
import { getStandaloneLogWriter } from './logWriter.js';
import TauriWorkerService from './service.js';
import type { TauriCapabilities, TauriServiceGlobalOptions } from './types.js';

const log = createLogger('tauri-service', 'service');

// Store launcher instances for cleanup
const activeLaunchers = new Map<WebdriverIO.Browser, TauriLaunchService>();

/**
 * Initialize Tauri service in standalone mode
 */
export async function init(
  capabilities: TauriCapabilities,
  globalOptions?: TauriServiceGlobalOptions,
): Promise<WebdriverIO.Browser> {
  log.debug('Initializing Tauri service in standalone mode...');

  // Initialize standalone log writer if logging is enabled
  const serviceOptions = capabilities['wdio:tauriServiceOptions'];
  if (serviceOptions?.captureBackendLogs || serviceOptions?.captureFrontendLogs) {
    if (serviceOptions.logDir) {
      // Use explicit logDir if provided
      const writer = getStandaloneLogWriter();
      writer.initialize(serviceOptions.logDir);
      log.debug(`Standalone log writer initialized at ${writer.getLogDir()}`);
    } else {
      log.warn('Standalone logging enabled but logDir not specified - logs will not be captured');
    }
  }

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

  // Create a deep clone for driver initialization so we can strip unsupported props
  const driverCapabilities = structuredClone(capabilities);

  const stripUnsupportedProps = (cap: TauriCapabilities | undefined) => {
    if (!cap || typeof cap !== 'object') {
      return;
    }
    delete (cap as { hostname?: string }).hostname;
    delete (cap as { port?: number }).port;
    delete (cap as { browserName?: string }).browserName;
  };

  if (Array.isArray(driverCapabilities)) {
    for (const cap of driverCapabilities) {
      stripUnsupportedProps(cap);
    }
  } else if (driverCapabilities && typeof driverCapabilities === 'object') {
    const maybeMultiRemote = driverCapabilities as Record<string, { capabilities?: TauriCapabilities }>;
    const entries = Object.values(maybeMultiRemote);
    const isMultiRemote = entries.every((entry) => entry && typeof entry === 'object' && 'capabilities' in entry);
    if (isMultiRemote) {
      for (const entry of entries) {
        stripUnsupportedProps(entry?.capabilities);
      }
    } else {
      stripUnsupportedProps(driverCapabilities as TauriCapabilities);
    }
  }

  log.debug(`Connection info for remote(): hostname=${hostname}, port=${port}, browserName=wry (display only)`);

  // Create worker service
  const service = new TauriWorkerService(capabilities['wdio:tauriServiceOptions'] || {}, capabilities);

  // Initialize session - connection info must be at top level, not in capabilities
  const browser = await remote({
    hostname,
    port,
    capabilities: driverCapabilities,
  });

  // Store launcher for cleanup
  activeLaunchers.set(browser, launcher);

  // Initialize the service
  await service.before(capabilities, [], browser);

  log.debug('Tauri standalone session initialized');
  return browser;
}

/**
 * Clean up Tauri service for a standalone session
 * Call this when you're done with a browser instance created via init()
 */
export async function cleanup(browser: WebdriverIO.Browser): Promise<void> {
  log.debug('Cleaning up Tauri standalone session...');

  const launcher = activeLaunchers.get(browser);
  if (launcher) {
    // End worker session
    await launcher.onWorkerEnd('standalone');

    // Complete the launcher lifecycle to stop tauri-driver
    // Create minimal config object matching Options.Testrunner
    const minimalConfig: Options.Testrunner = {
      capabilities: [],
    } as Options.Testrunner;
    await launcher.onComplete(0, minimalConfig, []);

    // Close standalone log writer
    const writer = getStandaloneLogWriter();
    writer.close();

    // Remove from active launchers
    activeLaunchers.delete(browser);
    log.debug('Tauri standalone session cleaned up');
  } else {
    log.warn('No launcher found for this browser instance');
  }
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
    // Don't set browserName - tauri-driver doesn't need it
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
