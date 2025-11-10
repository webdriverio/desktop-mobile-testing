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

  // Check platform first - skip macOS Tauri tests due to WKWebView limitations
  if (process.platform === 'darwin') {
    console.log('⚠️ Skipping Tauri tests on macOS due to WKWebView WebDriver limitations');
    process.exit(78); // Exit code 78 indicates skipped tests
  }

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

  const tauriConfig = safeJsonParse(readFileSync(tauriConfigPath, 'utf-8'), {});
  const productName = (tauriConfig as { productName?: string })?.productName || 'tauri-app';

  console.log('🔍 Tauri config debug:');
  console.log('  Config path:', tauriConfigPath);
  console.log('  productName:', (tauriConfig as { productName?: string })?.productName);
  console.log('  Resolved productName:', productName);

  // Platform-specific binary paths
  let appBinaryPath: string;
  if (process.platform === 'win32') {
    appBinaryPath = join(tauriTargetDir, `${productName}.exe`);
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
  case 'multiremote':
    specs = ['./test/tauri/multiremote/*.spec.ts'];
    break;
  case 'standalone':
    specs = ['./test/tauri/standalone/*.spec.ts'];
    break;
  default:
    // Standard tests - core functionality without specialized test modes
    specs = ['./test/tauri/*.spec.ts'];
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
    captureBackendLogs?: boolean;
    captureFrontendLogs?: boolean;
    backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  };
};

type InstanceConfig = {
  capabilities: TauriCapability;
  hostname?: string;
  port?: number;
};

type MultiremoteCapabilities = {
  browserA: InstanceConfig;
  browserB: InstanceConfig;
};

type StandardCapabilities = TauriCapability[];

let capabilities: MultiremoteCapabilities | StandardCapabilities;

if (envContext.isMultiremote) {
  // Tauri multiremote configuration
  // The service automatically handles data directory isolation for multiremote instances
  capabilities = {
    browserA: {
      capabilities: {
        browserName: 'tauri',
        'tauri:options': {
          application: appBinaryPath,
          args: ['--browser=A'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--browser=A'],
          // Enable log capture for logging tests
          captureBackendLogs: true,
          captureFrontendLogs: true,
          backendLogLevel: 'info',
          frontendLogLevel: 'info',
        },
      },
      hostname: '127.0.0.1',
      port: 0, // Will be set dynamically by launcher
    },
    browserB: {
      capabilities: {
        browserName: 'tauri',
        'tauri:options': {
          application: appBinaryPath,
          args: ['--browser=B'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--browser=B'],
          // Enable log capture for logging tests
          captureBackendLogs: true,
          captureFrontendLogs: true,
          backendLogLevel: 'info',
          frontendLogLevel: 'info',
        },
      },
      hostname: '127.0.0.1',
      port: 0, // Will be set dynamically by launcher
    },
  };
} else {
  // Tauri standard configuration
  capabilities = [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: appBinaryPath,
        args: ['foo', 'bar=baz'],
      },
      'wdio:tauriServiceOptions': {
        appBinaryPath: appBinaryPath,
        appArgs: ['foo', 'bar=baz'],
        // Enable log capture for logging tests
        captureBackendLogs: true,
        captureFrontendLogs: true,
        backendLogLevel: 'info',
        frontendLogLevel: 'info',
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
  ...(envContext.isMultiremote ? ({} as Record<string, unknown>) : { hostname: '127.0.0.1', port: 4444 }),
  logLevel: 'debug',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  // Don't use autoXvfb - tauri-driver runs in launcher (not worker) and needs display
  // The entire test command must be wrapped with xvfb-run in CI
  autoXvfb: false,
  services: [['@wdio/tauri-service']],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: logDir,
};
