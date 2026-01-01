import { expect, multiremotebrowser } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { assertLogContains, findLogEntries, readWdioLogs } from '../helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('Electron Log Integration - Multiremote', () => {
  it('should capture main process logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate logs on both instances
    await Promise.all([
      browserA.electron.execute(() => {
        console.info('[Test] Instance browserA main process INFO log');
        console.warn('[Test] Instance browserA main process WARN log');
        console.error('[Test] Instance browserA main process ERROR log');
      }),
      browserB.electron.execute(() => {
        console.info('[Test] Instance browserB main process INFO log');
        console.warn('[Test] Instance browserB main process WARN log');
        console.error('[Test] Instance browserB main process ERROR log');
      }),
    ]);

    // Wait for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify logs were captured with correct prefixes and instance IDs
    const logDir = path.join(__dirname, '..', '..', '..', 'logs');
    console.log(`[DEBUG] Reading multiremote logs from: ${logDir}`);
    const logs = readWdioLogs(logDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Both instances should have main process logs with [Electron:MainProcess:instanceId] prefix
    assertLogContains(logs, /\[Electron:MainProcess:browserA\].*\[Test\].*Instance browserA.*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:browserB\].*\[Test\].*Instance browserB.*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:(browserA|browserB)\].*\[Test\].*WARN/i);
    assertLogContains(logs, /\[Electron:MainProcess:(browserA|browserB)\].*\[Test\].*ERROR/i);

    // Verify we have logs from both instances with their IDs
    const mainProcessLogs = findLogEntries(logs, /\[Electron:MainProcess:(browserA|browserB)\]/i);
    console.log(`[DEBUG] Found ${mainProcessLogs.length} main process log entries from both instances`);
    expect(mainProcessLogs.length).toBeGreaterThan(0);
  });

  it('should capture renderer logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate renderer logs on both instances
    await Promise.all([
      browserA.execute(() => {
        console.info('[Test] Instance browserA renderer INFO log');
        console.warn('[Test] Instance browserA renderer WARN log');
      }),
      browserB.execute(() => {
        console.info('[Test] Instance browserB renderer INFO log');
        console.warn('[Test] Instance browserB renderer WARN log');
      }),
    ]);

    // Wait for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify renderer logs were captured with correct prefixes
    const logDir = path.join(__dirname, '..', '..', '..', 'logs');
    const logs = readWdioLogs(logDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Verify both instances' renderer logs are captured with instance IDs
    assertLogContains(logs, /\[Electron:Renderer:browserA\].*\[Test\].*Instance browserA renderer INFO/i);
    assertLogContains(logs, /\[Electron:Renderer:browserB\].*\[Test\].*Instance browserB renderer INFO/i);

    const rendererLogs = findLogEntries(logs, /\[Electron:Renderer:(browserA|browserB)\]/i);
    console.log(`[DEBUG] Found ${rendererLogs.length} renderer log entries from both instances`);
    expect(rendererLogs.length).toBeGreaterThan(0);
  });

  it('should capture logs independently per instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate different logs on each instance
    await Promise.all([
      browserA.electron.execute(() => {
        console.info('[Test] BrowserA main process only log');
      }),
      browserB.execute(() => {
        console.info('[Test] BrowserB renderer only log');
      }),
    ]);

    // Wait for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify both types of logs are captured independently
    const logDir = path.join(__dirname, '..', '..', '..', 'logs');
    const logs = readWdioLogs(logDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Instance browserA should have main process logs with instance ID
    assertLogContains(logs, /\[Electron:MainProcess:browserA\].*\[Test\].*BrowserA main process only log/i);

    // Instance browserB should have renderer logs with instance ID
    assertLogContains(logs, /\[Electron:Renderer:browserB\].*\[Test\].*BrowserB renderer only log/i);

    // Verify both types exist
    const mainProcessLogs = findLogEntries(logs, /\[Electron:MainProcess:(browserA|browserB)\]/i);
    const rendererLogs = findLogEntries(logs, /\[Electron:Renderer:(browserA|browserB)\]/i);
    console.log(`[DEBUG] Found ${mainProcessLogs.length} main process and ${rendererLogs.length} renderer log entries`);
    expect(mainProcessLogs.length).toBeGreaterThan(0);
    expect(rendererLogs.length).toBeGreaterThan(0);
  });

  it('should apply different log levels per instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate logs at different levels on both instances
    await Promise.all([
      browserA.electron.execute(() => {
        console.debug('[Test] BrowserA DEBUG log');
        console.info('[Test] BrowserA INFO log');
      }),
      browserB.electron.execute(() => {
        console.debug('[Test] BrowserB DEBUG log');
        console.info('[Test] BrowserB INFO log');
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const logDir = path.join(__dirname, '..', '..', '..', 'logs');
    const logs = readWdioLogs(logDir);

    // With default 'info' level, DEBUG should be filtered out
    const debugLogs = findLogEntries(logs, /\[Electron:MainProcess:(browserA|browserB)\].*DEBUG/i);
    expect(debugLogs.length).toBe(0);

    // INFO logs should be present for both instances
    assertLogContains(logs, /\[Electron:MainProcess:browserA\].*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:browserB\].*INFO/i);
  });
});
