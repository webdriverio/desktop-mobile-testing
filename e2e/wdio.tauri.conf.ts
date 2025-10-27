import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NormalizedPackageJson } from 'read-package-up';

import { createEnvironmentContext } from './config/envSchema.js';
import { fileExists, safeJsonParse } from './lib/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Configuration context for WDIO Tauri tests
 */
interface TauriConfigContext {
  envContext: ReturnType<typeof createEnvironmentContext>;
  appPath: string;
  appBinaryPath: string;
  packageJson: NormalizedPackageJson;
}

/**
 * Get Tauri configuration context
 */
async function getTauriConfigContext(): Promise<TauriConfigContext> {
  console.log('🔍 Creating WDIO Tauri configuration context...');

  // Parse and validate environment
  const envContext = createEnvironmentContext();

  // Ensure we're using Tauri framework
  if (envContext.framework !== 'tauri') {
    throw new Error(`This config is for Tauri framework, got: ${envContext.framework}`);
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
    name: 'tauri-app',
    version: '1.0.0',
    readme: '',
    _id: 'tauri-app@1.0.0',
  } as NormalizedPackageJson);

  // Set package.json on globalThis for tests
  globalThis.packageJson = packageJson;

  console.log('🔍 Setting up Tauri test with app binary path');

  // For Tauri, we need to find the built binary in src-tauri/target/release
  const tauriTargetDir = join(appPath, 'src-tauri', 'target', 'release');
  const tauriConfigPath = join(appPath, 'src-tauri', 'tauri.conf.json');

  if (!fileExists(tauriConfigPath)) {
    throw new Error(`Tauri config not found: ${tauriConfigPath}`);
  }

  const tauriConfig = safeJsonParse(readFileSync(tauriConfigPath, 'utf-8'));
  const productName = tauriConfig?.package?.productName || 'tauri-app';

  // Platform-specific binary paths
  let appBinaryPath: string;
  if (process.platform === 'win32') {
    appBinaryPath = join(tauriTargetDir, `${productName}.exe`);
  } else if (process.platform === 'darwin') {
    // Skip macOS Tauri tests due to WKWebView limitations
    throw new Error(
      `Tauri testing is not supported on macOS due to WKWebView WebDriver limitations. Please run tests on Windows or Linux.`,
    );
  } else if (process.platform === 'linux') {
    appBinaryPath = join(tauriTargetDir, productName.toLowerCase());
  } else {
    throw new Error(`Unsupported platform for Tauri: ${process.platform}`);
  }

  console.log(`Using Tauri binary: ${appBinaryPath}`);

  if (!fileExists(appBinaryPath)) {
    throw new Error(`Tauri binary not found: ${appBinaryPath}. Make sure the app is built.`);
  }

  return {
    envContext,
    appPath,
    appBinaryPath,
    packageJson,
  };
}

const context = await getTauriConfigContext();
const { envContext, appBinaryPath } = context;

// Configure specs based on test type
let specs: string[] = [];
switch (envContext.testType) {
  case 'window':
    specs = ['./test/tauri/window.spec.ts'];
    break;
  case 'multiremote':
    specs = ['./test/tauri/multiremote/*.spec.ts'];
    break;
  case 'standalone':
    specs = ['./test/tauri/standalone/api.spec.ts'];
    break;
  default:
    specs = [
      './test/tauri/commands.spec.ts',
      './test/tauri/window.spec.ts',
      './test/tauri/filesystem.spec.ts',
      './test/tauri/platform.spec.ts',
      './test/tauri/backend-access.spec.ts',
    ];
    break;
}

// Configure capabilities
type TauriCapability = {
  browserName?: 'tauri';
  'tauri:options': {
    application: string;
    args?: string[];
  };
  'wdio:tauriServiceOptions': {
    appBinaryPath: string;
    appArgs: string[];
  };
};

type MultiremoteCapabilities = {
  browserA: {
    capabilities: TauriCapability;
  };
  browserB: {
    capabilities: TauriCapability;
  };
};

type StandardCapabilities = TauriCapability[];

let capabilities: MultiremoteCapabilities | StandardCapabilities;

if (envContext.isMultiremote) {
  // Tauri multiremote configuration
  capabilities = {
    browserA: {
      capabilities: {
        'tauri:options': {
          application: appBinaryPath,
          args: ['--foo', '--bar=baz', '--browser=A'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--foo', '--bar=baz', '--browser=A'],
        },
      },
    },
    browserB: {
      capabilities: {
        'tauri:options': {
          application: appBinaryPath,
          args: ['--foo', '--bar=baz', '--browser=B'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--foo', '--bar=baz', '--browser=B'],
        },
      },
    },
  };
} else {
  // Tauri standard configuration
  capabilities = [
    {
      'tauri:options': {
        application: appBinaryPath,
        args: ['foo', 'bar=baz'],
      },
      'wdio:tauriServiceOptions': {
        appBinaryPath: appBinaryPath,
        appArgs: ['foo', 'bar=baz'],
      },
    },
  ];
}

// Create log directory
const logDir = join(__dirname, 'logs', `${envContext.testType}-${envContext.appDirName}`);

// Export the configuration object directly
export const config = {
  runner: 'local',
  specs,
  exclude: [],
  maxInstances: 1,
  capabilities,
  // Connect to tauri-driver instead of spawning a browser driver
  hostname: '127.0.0.1',
  port: 4444,
  logLevel: envContext.env.WDIO_VERBOSE === 'true' ? 'debug' : 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  autoXvfb: true,
  services: [['@wdio/tauri-service']],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: logDir,
};
