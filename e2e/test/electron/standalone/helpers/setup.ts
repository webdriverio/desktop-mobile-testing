import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import {
  cleanupWdioSession,
  createElectronCapabilities,
  getElectronBinaryPath,
  startWdioSession,
} from '@wdio/electron-service';
import type { ElectronServiceOptions } from '@wdio/native-types';
import type { Capabilities } from '@wdio/types';
import { xvfb } from '@wdio/xvfb';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export interface StandaloneTestOptions {
  /**
   * Optional log capture configuration
   */
  logConfig?: {
    captureMainProcessLogs?: boolean;
    captureRendererLogs?: boolean;
    mainProcessLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    rendererLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    logDir?: string;
  };
}

export interface StandaloneTestSession {
  browser: WebdriverIO.Browser;
  appDir: string;
  cleanup: () => Promise<void>;
}

type StandaloneCapability = Capabilities.RequestedStandaloneCapabilities & {
  'wdio:electronServiceOptions'?: ElectronServiceOptions;
};

/**
 * Set up a standalone Electron test session with shared configuration
 */
export async function setupStandaloneTest(options: StandaloneTestOptions = {}): Promise<StandaloneTestSession> {
  process.env.TEST = 'true';

  // Electron app directory - use APP_DIR env var or default to electron-builder
  const defaultAppDir = path.join(__dirname, '..', '..', '..', '..', '..', 'fixtures', 'e2e-apps', 'electron-builder');
  const appDir = process.env.APP_DIR || defaultAppDir;

  if (!fs.existsSync(appDir)) {
    throw new Error(`Electron app directory not found: ${appDir}`);
  }

  // Determine if this is a no-binary app (has dist/main.js instead of a built binary)
  const appDirName = path.basename(appDir);
  const isNoBinary = appDirName.includes('no-binary');
  const entryPoint = path.join(appDir, 'dist', 'main.js');

  let sessionOptions: StandaloneCapability;

  if (isNoBinary && fs.existsSync(entryPoint)) {
    // No-binary mode: use entry point
    sessionOptions = {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        appEntryPoint: entryPoint,
        appArgs: ['foo', 'bar=baz'],
      },
    };
  } else {
    // Binary mode: resolve binary path
    const appBinaryPath = await getElectronBinaryPath(appDir);
    const capabilities = createElectronCapabilities(appBinaryPath, appDir, {
      appArgs: ['foo', 'bar=baz'],
    });
    // createElectronCapabilities returns an array, unwrap it
    sessionOptions = Array.isArray(capabilities) ? capabilities[0] : capabilities;
  }

  // Apply log configuration if provided
  if (options.logConfig) {
    const serviceOptions = (sessionOptions as Record<string, unknown>)['wdio:electronServiceOptions'] as Record<
      string,
      unknown
    >;
    if (serviceOptions) {
      if (options.logConfig.captureMainProcessLogs !== undefined) {
        serviceOptions.captureMainProcessLogs = options.logConfig.captureMainProcessLogs;
      }
      if (options.logConfig.captureRendererLogs !== undefined) {
        serviceOptions.captureRendererLogs = options.logConfig.captureRendererLogs;
      }
      if (options.logConfig.mainProcessLogLevel) {
        serviceOptions.mainProcessLogLevel = options.logConfig.mainProcessLogLevel;
      }
      if (options.logConfig.rendererLogLevel) {
        serviceOptions.rendererLogLevel = options.logConfig.rendererLogLevel;
      }
      if (options.logConfig.logDir) {
        serviceOptions.logDir = options.logConfig.logDir;
      }
    }
  }

  // Initialize xvfb if running on Linux
  if (process.platform === 'linux') {
    await xvfb.init();
  }

  // Start the session
  const browser = await startWdioSession([sessionOptions]);

  // Wait for browser to be fully initialized
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Return session with cleanup function
  return {
    browser,
    appDir,
    cleanup: async () => {
      await browser.deleteSession();
      await cleanupWdioSession(browser);
    },
  };
}
