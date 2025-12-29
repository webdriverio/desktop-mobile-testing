import path from 'node:path';
import url from 'node:url';
import { assertLogContains, assertLogDoesNotContain, readWdioLogs } from '../helpers/logging.js';
import { setupStandaloneTest } from './helpers/setup.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Determine log directory based on app
const appDirName = path.basename(process.env.APP_DIR || 'electron-builder');
const logDir = path.join(__dirname, '..', '..', '..', 'logs', `standalone-${appDirName}`);

console.log('🔍 Debug: Starting Electron standalone logging test');

// Set up standalone test session with log capture enabled
const { browser, cleanup } = await setupStandaloneTest({
  logConfig: {
    captureMainProcessLogs: true,
    captureRendererLogs: true,
    mainProcessLogLevel: 'info',
    rendererLogLevel: 'info',
    logDir,
  },
});

try {
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
  await cleanup();
  process.exit(1);
}

// Clean up - quit the app
await cleanup();
console.log('✅ Cleanup complete');
