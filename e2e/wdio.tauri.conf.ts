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

  // Parse and validate environment first (needed to check driverProvider)
  const envContext = createEnvironmentContext();

  // Skip macOS Tauri tests only for official tauri-driver
  // CrabNebula and embedded providers support macOS
  if (process.platform === 'darwin' && envContext.driverProvider === 'official') {
    console.log('⚠️ Skipping Tauri tests on macOS with official driver due to WKWebView WebDriver limitations');
    console.log('💡 Use driverProvider: "crabnebula" or "embedded" for macOS support');
    process.exit(78); // Exit code 78 indicates skipped tests
  }

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
  } else if (process.platform === 'darwin') {
    // macOS: CrabNebula and embedded providers support macOS
    appBinaryPath = join(tauriTargetDir, productName);
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
let exclude: string[] = [];
let maxInstances = 5;
switch (envContext.testType) {
  case 'multiremote':
    specs = ['./test/tauri/multiremote/*.spec.ts'];
    maxInstances = 1;
    break;
  case 'standalone':
    specs = ['./test/tauri/standalone/*.spec.ts'];
    break;
  case 'window':
    // Window tests - only window-specific functionality
    specs = ['./test/tauri/window.spec.ts'];
    break;
  case 'deeplink':
    // Deeplink tests require single-instance mode and sequential execution
    specs = ['./test/tauri/deeplink.spec.ts'];
    maxInstances = 1;
    break;
  default:
    // Standard tests - core functionality without specialized test modes
    specs = ['./test/tauri/*.spec.ts'];
    // Exclude:
    // - mocking tests (require special setup)
    // - window tests (require splash)
    // - deeplink tests (require single-instance)
    // - embedded limitation tests (not applicable to tauri-driver)
    exclude = [
      './test/tauri/mocking.spec.ts',
      './test/tauri/window.spec.ts',
      './test/tauri/deeplink.spec.ts',
      './test/tauri/logging.embedded.spec.ts',
    ];
    break;
}

// Configure capabilities
type TauriCapability = {
  browserName?: 'tauri';
  'wdio:enforceWebDriverClassic'?: boolean;
  'tauri:options': {
    application: string;
    args?: string[];
  };
  'wdio:tauriServiceOptions': {
    appBinaryPath: string;
    appArgs: string[];
    env?: Record<string, string>;
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
  // Tauri multiremote configuration - create base env for tauri-driver
  const baseEnv: Record<string, string> = {};
  if (envContext.isSplashEnabled) {
    baseEnv.ENABLE_SPLASH_WINDOW = 'true';
  }

  // The service automatically handles data directory isolation for multiremote instances
  capabilities = {
    browserA: {
      capabilities: {
        browserName: 'tauri',
        'wdio:enforceWebDriverClassic': true,
        'tauri:options': {
          application: appBinaryPath,
          args: ['--browser=A'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--browser=A'],
          env: baseEnv,
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
        'wdio:enforceWebDriverClassic': true,
        'tauri:options': {
          application: appBinaryPath,
          args: ['--browser=B'],
        },
        'wdio:tauriServiceOptions': {
          appBinaryPath: appBinaryPath,
          appArgs: ['--browser=B'],
          env: baseEnv,
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
  const baseEnv: Record<string, string> = {};
  if (envContext.isSplashEnabled) {
    baseEnv.ENABLE_SPLASH_WINDOW = 'true';
  }
  if (envContext.testType === 'deeplink') {
    baseEnv.ENABLE_SINGLE_INSTANCE = 'true';
  }

  capabilities = [
    {
      browserName: 'tauri',
      'wdio:enforceWebDriverClassic': true,
      'tauri:options': {
        application: appBinaryPath,
        args: ['foo', 'bar=baz'],
      },
      'wdio:tauriServiceOptions': {
        appBinaryPath: appBinaryPath,
        appArgs: ['foo', 'bar=baz'],
        env: baseEnv,
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
  exclude,
  // Auto-detection: maxInstances > 1 enables per-worker drivers for parallel execution
  // Each worker gets its own tauri-driver process on a unique port
  maxInstances, // Use computed maxInstances based on test type
  capabilities,
  // Port and hostname are set dynamically by the tauri-service in onPrepare
  // Do not set port here - WDIO's detectBackend converts port: 0 to port: 4444
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  // Don't use autoXvfb - tauri-driver runs in launcher (not worker) and needs display
  // The entire test command must be wrapped with xvfb-run in CI
  autoXvfb: false,
  services: [
    [
      '@wdio/tauri-service',
      {
        driverProvider: envContext.driverProvider || 'official',
        autoInstallTauriDriver: envContext.driverProvider !== 'crabnebula',
      },
    ],
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  outputDir: logDir,
};
