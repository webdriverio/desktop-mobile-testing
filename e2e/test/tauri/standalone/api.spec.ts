import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { cleanupWdioSession, createTauriCapabilities, getTauriBinaryPath, startWdioSession } from '@wdio/tauri-service';
import '@wdio/native-types';
import { xvfb } from '@wdio/xvfb';

// Get the directory name once at the top
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

process.env.TEST = 'true';

console.log('🔍 Debug: Starting standalone test for Tauri');

// Tauri app directory (always use tauri app, no exampleDir variation needed)
const appDir = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'e2e-apps', 'tauri');

if (!fs.existsSync(appDir)) {
  throw new Error(`Tauri app directory not found: ${appDir}`);
}

// Resolve binary path
const appBinaryPath = await getTauriBinaryPath(appDir);
console.log(`🔍 Using Tauri binary: ${appBinaryPath}`);

// Create session options
const sessionOptions = createTauriCapabilities(appBinaryPath, {
  appArgs: ['foo', 'bar=baz'],
});

// Initialize xvfb if running on Linux
if (process.platform === 'linux') {
  console.log('🔍 Linux detected: initializing xvfb for standalone tests...');
  await xvfb.init();
}

console.log('🔍 Debug: Starting session with options:', JSON.stringify(sessionOptions, null, 2));
const browser = await startWdioSession(sessionOptions);

// Wait a moment to ensure browser is fully initialized with all service capabilities
await new Promise((resolve) => setTimeout(resolve, 1000));

// Test execute with new function syntax
const platformInfo = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));

if (!platformInfo || typeof platformInfo !== 'object') {
  throw new Error(`Platform info test failed: expected object, got ${typeof platformInfo}`);
}

if (!('os' in platformInfo)) {
  throw new Error(`Platform info test failed: missing 'os' property`);
}

if (!('arch' in platformInfo)) {
  throw new Error(`Platform info test failed: missing 'arch' property`);
}

console.log('✅ Platform info test passed:', platformInfo);

// Test that execute works in standalone mode
const simpleResult = await browser.tauri.execute(() => 1 + 2);
if (simpleResult !== 3) {
  throw new Error(`Simple execute test failed: expected 3, got ${simpleResult}`);
}

console.log('✅ Simple execute test passed');

// Clean up - quit the app and stop tauri-driver
await browser.deleteSession();
await cleanupWdioSession(browser);

// Exit cleanly with success code
process.exit(0);
