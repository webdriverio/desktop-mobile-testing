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
import { assertLogContains, assertLogDoesNotContain, readWdioLogs } from '../helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

process.env.TEST = 'true';

// Electron app directory - use APP_DIR env var or default to electron-builder
const defaultAppDir = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'e2e-apps', 'electron-builder');
const appDir = process.env.APP_DIR || defaultAppDir;

if (!fs.existsSync(appDir)) {
  throw new Error(`Electron app directory not found: ${appDir}`);
}

// Determine if this is a no-binary app (has dist/main.js instead of a built binary)
const appDirName = path.basename(appDir);
const isNoBinary = appDirName.includes('no-binary');
const entryPoint = path.join(appDir, 'dist', 'main.js');

// Type for individual standalone capability (before wrapping in array)
type StandaloneCapability = Capabilities.RequestedStandaloneCapabilities & {
  'wdio:electronServiceOptions'?: ElectronServiceOptions;
};

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

// Enable log capture
const serviceOptions = (sessionOptions as Record<string, unknown>)['wdio:electronServiceOptions'] as Record<
  string,
  unknown
>;
if (serviceOptions) {
  serviceOptions.captureMainProcessLogs = true;
  serviceOptions.captureRendererLogs = true;
  serviceOptions.mainProcessLogLevel = 'info';
  serviceOptions.rendererLogLevel = 'info';
  // Set log directory - full path where logs should be written
  const appDirName = path.basename(appDir);
  const logDir = path.join(__dirname, '..', '..', '..', 'logs', `standalone-${appDirName}`);
  serviceOptions.logDir = logDir;
}

// Initialize xvfb if running on Linux
if (process.platform === 'linux') {
  await xvfb.init();
}

console.log('🔍 Debug: Starting Electron standalone logging test');

const browser = await startWdioSession([sessionOptions]);

// Wait a moment to ensure browser is fully initialized
await new Promise((resolve) => setTimeout(resolve, 1000));

try {
  // For standalone tests, logs go to logs/standalone-{appDirName}/
  // Since standalone tests don't run through WDIO, we need to construct the path manually
  const appDirName = path.basename(appDir);
  const logDir = path.join(__dirname, '..', '..', '..', 'logs', `standalone-${appDirName}`);

  // Test 1: Capture main process logs in standalone session
  console.log('Test 1: Main process logs...');
  await browser.electron.execute(() => {
    console.info('[Test] Standalone main process INFO log');
    console.warn('[Test] Standalone main process WARN log');
    console.error('[Test] Standalone main process ERROR log');
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify logs were captured with correct prefix
  const logs1 = readWdioLogs(logDir);
  if (!logs1) {
    throw new Error('No logs found in output directory');
  }
  assertLogContains(logs1, /\[Electron:MainProcess\].*\[Test\].*INFO log/i);
  assertLogContains(logs1, /\[Electron:MainProcess\].*\[Test\].*WARN log/i);
  assertLogContains(logs1, /\[Electron:MainProcess\].*\[Test\].*ERROR log/i);
  console.log('✅ Main process logs test passed');

  // Test 2: Capture renderer logs in standalone session
  console.log('Test 2: Renderer logs...');
  await browser.execute(() => {
    console.info('[Test] Standalone renderer INFO log');
    console.warn('[Test] Standalone renderer WARN log');
    console.error('[Test] Standalone renderer ERROR log');
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify renderer logs were captured with correct prefix
  const logs2 = readWdioLogs(logDir);
  assertLogContains(logs2, /\[Electron:Renderer\].*\[Test\].*Standalone renderer INFO/i);
  assertLogContains(logs2, /\[Electron:Renderer\].*\[Test\].*Standalone renderer WARN/i);
  assertLogContains(logs2, /\[Electron:Renderer\].*\[Test\].*Standalone renderer ERROR/i);
  console.log('✅ Renderer logs test passed');

  // Test 3: Filter logs by level in standalone session
  console.log('Test 3: Log level filtering...');
  await browser.electron.execute(() => {
    console.debug('[Test] This main DEBUG log should be filtered out');
    console.info('[Test] This main INFO log should appear');
  });
  await browser.execute(() => {
    console.debug('[Test] This renderer DEBUG log should be filtered out');
    console.info('[Test] This renderer INFO log should appear');
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify DEBUG logs are filtered out (info level filtering)
  const logs3 = readWdioLogs(logDir);
  assertLogDoesNotContain(logs3, /\[Electron:MainProcess\].*DEBUG.*should be filtered/i);
  assertLogDoesNotContain(logs3, /\[Electron:Renderer\].*DEBUG.*should be filtered/i);
  assertLogContains(logs3, /\[Electron:MainProcess\].*INFO.*should appear/i);
  assertLogContains(logs3, /\[Electron:Renderer\].*INFO.*should appear/i);
  console.log('✅ Log filtering test passed');

  console.log('✅ All Electron standalone logging tests passed');
} catch (error) {
  console.error('❌ Test failed:', error);
  // Clean up before exiting with error
  await browser.deleteSession();
  await cleanupWdioSession(browser);
  process.exit(1);
}

// Clean up - quit the app
await browser.deleteSession();
await cleanupWdioSession(browser);
console.log('✅ Cleanup complete');
