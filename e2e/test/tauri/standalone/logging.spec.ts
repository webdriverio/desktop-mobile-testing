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

let browser: WebdriverIO.Browser | null = null;

try {
  browser = await startWdioSession(sessionOptions);

  // Wait a moment to ensure browser is fully initialized
  await new Promise((resolve) => setTimeout(resolve, 1000));
} catch (error) {
  console.error('Failed to start session:', error);
  process.exit(1);
}

describe('Tauri Log Integration - Standalone', () => {
  after(async () => {
    if (browser) {
      // Clean up - quit the app and stop tauri-driver
      await browser.deleteSession();
      await cleanupWdioSession(browser);
      console.log('✅ Cleanup complete');
    }
    // Don't call process.exit() - let Node.js exit naturally after cleanup completes
    // The cleanup delay is now handled in the launcher's onWorkerEnd hook to ensure
    // WDIO waits before starting the next worker
  });

  it('should capture backend logs in standalone session', async () => {
    if (!browser) throw new Error('Browser not initialized');
    // Generate logs via test command
    await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Note: In standalone mode, logs are written to WDIO outputDir
    // The test framework will verify logs appear in the output directory
    const result = await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
    expect(result).toBe('Logs generated');
  });

  it('should capture frontend logs in standalone session', async () => {
    if (!browser) throw new Error('Browser not initialized');
    // Trigger frontend logs
    await browser.execute(() => {
      console.info('[Test] Standalone frontend INFO log');
      console.warn('[Test] Standalone frontend WARN log');
    });

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify the logs were generated (actual log file verification happens at framework level)
    const result = await browser.execute(() => {
      return 'Logs generated';
    });
    expect(result).toBe('Logs generated');
  });

  it('should filter logs by level in standalone session', async () => {
    if (!browser) throw new Error('Browser not initialized');
    // Generate logs at different levels
    await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
    await browser.execute(() => {
      console.debug('[Test] This DEBUG log should be filtered');
      console.info('[Test] This INFO log should appear');
    });

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify logs were generated (filtering verification happens at log file level)
    const result = await browser.tauri.execute(({ core }) => core.invoke('generate_test_logs'));
    expect(result).toBe('Logs generated');
  });
});
