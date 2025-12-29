import type {
  ElectronServiceCapabilities,
  ElectronServiceGlobalOptions,
  ElectronServiceOptions,
} from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('electron-service', 'service');

import type { Options } from '@wdio/types';
import { remote } from 'webdriverio';
import ElectronLaunchService from './launcher.js';
import { getStandaloneLogWriter } from './logWriter.js';
import ElectronWorkerService from './service.js';

// Store launcher instances for cleanup
const activeLaunchers = new Map<WebdriverIO.Browser, ElectronLaunchService>();

/**
 * Initialize Electron service in standalone mode
 */
export async function init(
  capabilities: ElectronServiceCapabilities,
  globalOptions?: ElectronServiceGlobalOptions,
): Promise<WebdriverIO.Browser> {
  log.debug('Initializing Electron service in standalone mode...');

  // Unwrap array if needed
  const capability = Array.isArray(capabilities) ? capabilities[0] : capabilities;

  // Initialize standalone log writer if logging is enabled
  const serviceOptions = (capability as Record<string, unknown>)['wdio:electronServiceOptions'] as
    | ElectronServiceOptions
    | undefined;
  if (serviceOptions?.captureMainProcessLogs || serviceOptions?.captureRendererLogs) {
    if (serviceOptions.logDir) {
      // Use explicit logDir if provided
      const writer = getStandaloneLogWriter();
      writer.initialize(serviceOptions.logDir);
      log.debug(`Standalone log writer initialized at ${writer.getLogDir()}`);
    } else {
      log.warn('Standalone logging enabled but logDir not specified - logs will not be captured');
    }
  }

  const testRunnerOpts: Options.Testrunner = (globalOptions?.rootDir
    ? { rootDir: globalOptions.rootDir }
    : {}) as unknown as Options.Testrunner;
  const launcher = new ElectronLaunchService(
    globalOptions || {},
    capability as ElectronServiceCapabilities,
    testRunnerOpts,
  );

  // onPrepare expects array or multiremote format, so wrap as array
  await launcher.onPrepare(testRunnerOpts, [capability] as ElectronServiceCapabilities);

  // onWorkerStart also expects array format for consistency
  await launcher.onWorkerStart('', [capability] as WebdriverIO.Capabilities);

  log.debug('Session capabilities:', JSON.stringify(capability, null, 2));

  const service = new ElectronWorkerService(globalOptions, capability);

  // initialise session
  const browser = await remote({
    capabilities: capability,
  });

  // Store launcher for cleanup
  activeLaunchers.set(browser, launcher);

  await service.before(capability, [], browser);

  log.debug('Electron standalone session initialized');
  return browser;
}

/**
 * Clean up Electron service for a standalone session
 * Call this when you're done with a browser instance created via init()
 */
export async function cleanup(browser: WebdriverIO.Browser): Promise<void> {
  log.debug('Cleaning up Electron standalone session...');

  const launcher = activeLaunchers.get(browser);
  if (launcher) {
    // Close standalone log writer
    const writer = getStandaloneLogWriter();
    writer.close();

    // Remove from active launchers
    activeLaunchers.delete(browser);
    log.debug('Electron standalone session cleaned up');
  } else {
    log.warn('No launcher found for this browser instance');
  }
}

/**
 * Create Electron capabilities
 */
export function createElectronCapabilities(
  appBinaryPath: string,
  appEntryPoint?: string,
  options: {
    appArgs?: string[];
  } = {},
): ElectronServiceCapabilities {
  return {
    browserName: 'electron',
    'goog:chromeOptions': {
      binary: appBinaryPath,
      args: options.appArgs || [],
    },
    'wdio:electronServiceOptions': {
      appBinaryPath,
      appEntryPoint,
      appArgs: options.appArgs || [],
    },
  } as unknown as ElectronServiceCapabilities;
}
