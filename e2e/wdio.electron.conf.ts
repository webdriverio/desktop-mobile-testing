import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WdioElectronConfig } from '@wdio/native-types';
import type { NormalizedPackageJson } from 'read-package-up';

import { createEnvironmentContext } from './config/envSchema.js';
import { fileExists, safeJsonParse } from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration context for WDIO Electron tests
 */
interface ElectronConfigContext {
  envContext: ReturnType<typeof createEnvironmentContext>;
  appPath: string;
  appEntryPoint?: string;
  appBinaryPath?: string;
  packageJson: NormalizedPackageJson;
}

/**
 * Get Electron configuration context
 */
async function getElectronConfigContext(): Promise<ElectronConfigContext> {
  console.log('🔍 Creating WDIO Electron configuration context...');

  // Parse and validate environment
  const envContext = createEnvironmentContext();

  // Ensure we're using Electron framework
  if (envContext.framework !== 'electron') {
    throw new Error(`This config is for Electron framework, got: ${envContext.framework}`);
  }

  console.log(`Environment: ${envContext.toString()}`);

  // Determine app directory
  const appPath = envContext.env.APP_DIR || envContext.appDirPath;
  console.log(`App path: ${appPath}`);

  if (!existsSync(appPath)) {
    throw new Error(`App directory does not exist: ${appPath}`);
  }

  // Load package.json from app
  const packageJsonPath = join(appPath, 'package.json');
  if (!fileExists(packageJsonPath)) {
    throw new Error(`package.json not found: ${packageJsonPath}`);
  }

  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = safeJsonParse<NormalizedPackageJson>(packageJsonContent, {
    name: 'electron-app',
    version: '1.0.0',
    readme: '',
    _id: 'electron-app@1.0.0',
  } as NormalizedPackageJson);

  // Set package.json on globalThis for tests
  globalThis.packageJson = packageJson;

  let appEntryPoint: string | undefined;
  let appBinaryPath: string | undefined;

  if (envContext.isNoBinary) {
    console.log('🔍 Setting up no-binary test with entry point');

    appEntryPoint = join(appPath, 'dist', 'main.js');
    console.log(`Using app entry point: ${appEntryPoint}`);

    if (!fileExists(appEntryPoint)) {
      throw new Error(`App entry point not found: ${appEntryPoint}. Make sure the app is built.`);
    }
  } else {
    console.log('🔍 Setting up binary test with app binary path');

    try {
      // Import async utilities and resolve binary path directly
      const { getBinaryPath, getAppBuildInfo, getElectronVersion } = await import('@wdio/native-utils');

      const pkg = { packageJson, path: packageJsonPath };
      const electronVersion = await getElectronVersion(pkg);
      const appBuildInfo = await getAppBuildInfo(pkg);
      const binaryResult = await getBinaryPath(packageJsonPath, appBuildInfo, electronVersion);

      // Extract the actual path string from the result object
      appBinaryPath = typeof binaryResult === 'string' ? binaryResult : binaryResult.binaryPath;

      console.log('🔍 Found app binary at:', appBinaryPath);
    } catch (error) {
      throw new Error(`Failed to resolve binary path: ${error instanceof Error ? error.message : error}`);
    }
  }

  return {
    envContext,
    appPath,
    appEntryPoint,
    appBinaryPath,
    packageJson,
  };
}

const context = await getElectronConfigContext();
const { envContext, appEntryPoint, appBinaryPath } = context;

// Configure specs based on test type
let specs: string[] = [];
switch (envContext.testType) {
  case 'window':
    specs = ['./test/electron/window.spec.ts'];
    break;
  case 'multiremote':
    specs = ['./test/electron/multiremote/*.spec.ts'];
    break;
  case 'standalone':
    specs = ['./test/electron/standalone/api.spec.ts'];
    break;
  default:
    specs = [
      './test/electron/api.spec.ts',
      './test/electron/application.spec.ts',
      './test/electron/dom.spec.ts',
      './test/electron/interaction.spec.ts',
    ];
    break;
}

// Configure capabilities
type ElectronCapability = {
  browserName: 'electron';
  'wdio:electronServiceOptions': {
    appEntryPoint?: string;
    appBinaryPath?: string;
    appArgs: string[];
    apparmorAutoInstall?: string;
    captureMainProcessLogs?: boolean;
    captureRendererLogs?: boolean;
    mainProcessLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    rendererLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  };
};

type MultiremoteCapabilities = {
  browserA: {
    capabilities: ElectronCapability;
  };
  browserB: {
    capabilities: ElectronCapability;
  };
};

type StandardCapabilities = ElectronCapability[];

let capabilities: MultiremoteCapabilities | StandardCapabilities;

if (envContext.isMultiremote) {
  // Multiremote configuration
  capabilities = {
    browserA: {
      capabilities: {
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=A'],
          apparmorAutoInstall: 'sudo',
          captureMainProcessLogs: true,
          captureRendererLogs: true,
          mainProcessLogLevel: 'info',
          rendererLogLevel: 'info',
        },
      },
    },
    browserB: {
      capabilities: {
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
          appArgs: ['--foo', '--bar=baz', '--browser=B'],
          apparmorAutoInstall: 'sudo',
          captureMainProcessLogs: true,
          captureRendererLogs: true,
          mainProcessLogLevel: 'info',
          rendererLogLevel: 'info',
        },
      },
    },
  };
} else {
  // Standard configuration
  capabilities = [
    {
      browserName: 'electron',
      'wdio:electronServiceOptions': {
        ...(envContext.isNoBinary ? { appEntryPoint } : { appBinaryPath }),
        appArgs: ['foo', 'bar=baz'],
        apparmorAutoInstall: 'sudo',
      },
    },
  ];
}

// Create log directory
const logDir = join(__dirname, 'logs', `${envContext.testType}-${envContext.appDirName}`);

// Export the configuration object directly
export const config: WdioElectronConfig = {
  runner: 'local',
  specs,
  exclude: [],
  maxInstances: 1,
  capabilities,
  logLevel: envContext.env.WDIO_VERBOSE === 'true' ? 'debug' : 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  autoXvfb: true,
  services: ['electron'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: logDir,
};
