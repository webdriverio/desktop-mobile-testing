import { existsSync, readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Application directory
const appPath = path.resolve(__dirname);

// Resolve Tauri binary path (following E2E pattern)
const tauriTargetDir = join(appPath, 'src-tauri', 'target', 'release');
const tauriConfigPath = join(appPath, 'src-tauri', 'tauri.conf.json');

if (!existsSync(tauriConfigPath)) {
  throw new Error(`Tauri config not found: ${tauriConfigPath}`);
}

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf-8'));
const productName = (tauriConfig as { productName?: string })?.productName || 'tauri-app-example';

// Platform-specific binary paths
let appBinaryPath: string;
if (process.platform === 'win32') {
  appBinaryPath = join(tauriTargetDir, `${productName}.exe`);
} else if (process.platform === 'linux') {
  appBinaryPath = join(tauriTargetDir, productName.toLowerCase());
} else {
  throw new Error(`Unsupported platform for Tauri: ${process.platform}`);
}

if (!existsSync(appBinaryPath)) {
  throw new Error(`Tauri binary not found: ${appBinaryPath}. Make sure the app is built.`);
}

// Configure capabilities (simplified from E2E - no multiremote, no test args)
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

const capabilities: TauriCapability[] = [
  {
    browserName: 'tauri',
    'tauri:options': {
      application: appBinaryPath,
    },
    'wdio:tauriServiceOptions': {
      appBinaryPath: appBinaryPath,
      appArgs: [],
    },
  },
];

// Export the configuration object directly (matches E2E pattern)
export const config = {
  runner: 'local',
  specs: ['./test/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities,
  // Connect to tauri-driver (service spawns it)
  hostname: '127.0.0.1',
  port: 4444,
  logLevel: process.env.DEBUG ? 'debug' : 'info',
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
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
};
