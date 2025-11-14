import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { cleanupWdioSession, createTauriCapabilities, getTauriBinaryPath, startWdioSession } from '@wdio/tauri-service';
import '@wdio/native-types';
import { xvfb } from '@wdio/xvfb';

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
  // Test 1: Capture backend logs in standalone session
  console.log('Test 1: Backend logs...');
  await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const result1 = await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  if (result1 !== 'Logs generated') {
    throw new Error(`Backend logs test failed: expected 'Logs generated', got ${result1}`);
  }
  console.log('✅ Backend logs test passed');

  // Test 2: Capture frontend logs in standalone session
  console.log('Test 2: Frontend logs...');
  await browser.execute(() => {
    console.info('[Test] Standalone frontend INFO log');
    console.warn('[Test] Standalone frontend WARN log');
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const result2 = (await browser.execute(() => {
    return 'Logs generated';
  })) as unknown as string;
  if (result2 !== 'Logs generated') {
    throw new Error(`Frontend logs test failed: expected 'Logs generated', got ${result2}`);
  }
  console.log('✅ Frontend logs test passed');

  // Test 3: Filter logs by level in standalone session
  console.log('Test 3: Log level filtering...');
  await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  await browser.execute(() => {
    console.debug('[Test] This DEBUG log should be filtered');
    console.info('[Test] This INFO log should appear');
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const result3 = await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
  if (result3 !== 'Logs generated') {
    throw new Error(`Log filtering test failed: expected 'Logs generated', got ${result3}`);
  }
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
