import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { cleanupWdioSession, createTauriCapabilities, getTauriBinaryPath, startWdioSession } from '@wdio/tauri-service';
import '@wdio/native-types';
import { xvfb } from '@wdio/xvfb';
import { assertLogContains, assertLogDoesNotContain, readWdioLogs } from '../helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

process.env.TEST = 'true';

// Tauri app directory
const appDir = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'e2e-apps', 'tauri');

if (!fs.existsSync(appDir)) {
  throw new Error(`Tauri app directory not found: ${appDir}`);
}

// Resolve binary path
const appBinaryPath = await getTauriBinaryPath(appDir);

// Create session options with log capture enabled
const sessionOptions = createTauriCapabilities(appBinaryPath, {
  appArgs: ['foo', 'bar=baz'],
});

// Enable log capture
if (sessionOptions['wdio:tauriServiceOptions']) {
  sessionOptions['wdio:tauriServiceOptions'].captureBackendLogs = true;
  sessionOptions['wdio:tauriServiceOptions'].captureFrontendLogs = true;
  sessionOptions['wdio:tauriServiceOptions'].backendLogLevel = 'info';
  sessionOptions['wdio:tauriServiceOptions'].frontendLogLevel = 'info';
  // Set log base directory to e2e directory for consistent log paths
  const logBaseDir = path.join(__dirname, '..', '..', '..');
  sessionOptions['wdio:tauriServiceOptions'].logBaseDir = logBaseDir;
  console.log(`[DEBUG] Setting logBaseDir to: ${logBaseDir}`);
  console.log(`[DEBUG] __dirname: ${__dirname}`);
}

// Initialize xvfb if running on Linux
if (process.platform === 'linux') {
  await xvfb.init();
}

console.log('🔍 Debug: Starting Tauri standalone logging test');

const browser = await startWdioSession(sessionOptions);

// Wait a moment to ensure browser is fully initialized
await new Promise((resolve) => setTimeout(resolve, 1000));

try {
  // For standalone tests, logs go to logs/standalone-{appDirName}/
  // Since standalone tests don't run through WDIO, we need to construct the path manually
  const appDirName = path.basename(appDir);
  const logDir = path.join(__dirname, '..', '..', '..', 'logs', `standalone-${appDirName}`);

  // Test 1: Capture backend logs in standalone session
  console.log('Test 1: Backend logs...');
  await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify logs were captured with correct prefix
  console.log(`[DEBUG] Reading logs from: ${logDir}`);
  const logs1 = readWdioLogs(logDir);
  if (!logs1) {
    throw new Error('No logs found in output directory');
  }
  assertLogContains(logs1, /\[Tauri:Backend\].*\[Test\].*INFO level log/i);
  assertLogContains(logs1, /\[Tauri:Backend\].*\[Test\].*WARN level log/i);
  assertLogContains(logs1, /\[Tauri:Backend\].*\[Test\].*ERROR level log/i);
  console.log('✅ Backend logs test passed');

  // Test 2: Capture frontend logs in standalone session
  console.log('Test 2: Frontend logs...');
  await browser.execute(() => {
    console.info('[Test] Standalone frontend INFO log');
    console.warn('[Test] Standalone frontend WARN log');
    console.error('[Test] Standalone frontend ERROR log');
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify frontend logs were captured with correct prefix
  const logs2 = readWdioLogs(logDir);
  assertLogContains(logs2, /\[Tauri:Frontend\].*\[Test\].*Standalone frontend INFO/i);
  assertLogContains(logs2, /\[Tauri:Frontend\].*\[Test\].*Standalone frontend WARN/i);
  assertLogContains(logs2, /\[Tauri:Frontend\].*\[Test\].*Standalone frontend ERROR/i);
  console.log('✅ Frontend logs test passed');

  // Test 3: Filter logs by level in standalone session
  console.log('Test 3: Log level filtering...');
  await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  await browser.execute(() => {
    console.debug('[Test] This DEBUG log should be filtered out');
    console.info('[Test] This INFO log should appear');
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Verify DEBUG logs are filtered out (info level filtering)
  const logs3 = readWdioLogs(logDir);
  assertLogDoesNotContain(logs3, /\[Tauri:Frontend\].*DEBUG.*should be filtered/i);
  assertLogContains(logs3, /\[Tauri:Frontend\].*INFO.*should appear/i);
  console.log('✅ Log filtering test passed');

  console.log('✅ All Tauri standalone logging tests passed');
} catch (error) {
  console.error('❌ Test failed:', error);
  // Clean up before exiting with error
  await browser.deleteSession();
  await cleanupWdioSession(browser);
  process.exit(1);
}

// Clean up - quit the app and stop tauri-driver
await browser.deleteSession();
await cleanupWdioSession(browser);
console.log('✅ Cleanup complete');
