import { expect, multiremotebrowser } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { assertLogContains, findLogEntries, readWdioLogs } from '../helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('Electron Log Integration - Multiremote', () => {
  it('should capture main process logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const app1 = multi.getInstance('app1');
    const app2 = multi.getInstance('app2');

    // Generate logs on both instances
    await Promise.all([
      app1.electron.execute(() => {
        console.info('[Test] Instance app1 main process INFO log');
        console.warn('[Test] Instance app1 main process WARN log');
        console.error('[Test] Instance app1 main process ERROR log');
      }),
      app2.electron.execute(() => {
        console.info('[Test] Instance app2 main process INFO log');
        console.warn('[Test] Instance app2 main process WARN log');
        console.error('[Test] Instance app2 main process ERROR log');
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
    assertLogContains(logs, /\[Electron:MainProcess:app1\].*\[Test\].*Instance app1.*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:app2\].*\[Test\].*Instance app2.*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:(app1|app2)\].*\[Test\].*WARN/i);
    assertLogContains(logs, /\[Electron:MainProcess:(app1|app2)\].*\[Test\].*ERROR/i);

    // Verify we have logs from both instances with their IDs
    const mainProcessLogs = findLogEntries(logs, /\[Electron:MainProcess:(app1|app2)\]/i);
    console.log(`[DEBUG] Found ${mainProcessLogs.length} main process log entries from both instances`);
    expect(mainProcessLogs.length).toBeGreaterThan(0);
  });

  it('should capture renderer logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const app1 = multi.getInstance('app1');
    const app2 = multi.getInstance('app2');

    // Generate renderer logs on both instances
    await Promise.all([
      app1.execute(() => {
        console.info('[Test] Instance app1 renderer INFO log');
        console.warn('[Test] Instance app1 renderer WARN log');
      }),
      app2.execute(() => {
        console.info('[Test] Instance app2 renderer INFO log');
        console.warn('[Test] Instance app2 renderer WARN log');
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
    assertLogContains(logs, /\[Electron:Renderer:app1\].*\[Test\].*Instance app1 renderer INFO/i);
    assertLogContains(logs, /\[Electron:Renderer:app2\].*\[Test\].*Instance app2 renderer INFO/i);

    const rendererLogs = findLogEntries(logs, /\[Electron:Renderer:(app1|app2)\]/i);
    console.log(`[DEBUG] Found ${rendererLogs.length} renderer log entries from both instances`);
    expect(rendererLogs.length).toBeGreaterThan(0);
  });

  it('should capture logs independently per instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const app1 = multi.getInstance('app1');
    const app2 = multi.getInstance('app2');

    // Generate different logs on each instance
    await Promise.all([
      app1.electron.execute(() => {
        console.info('[Test] App1 main process only log');
      }),
      app2.execute(() => {
        console.info('[Test] App2 renderer only log');
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

    // Instance app1 should have main process logs with instance ID
    assertLogContains(logs, /\[Electron:MainProcess:app1\].*\[Test\].*App1 main process only log/i);

    // Instance app2 should have renderer logs with instance ID
    assertLogContains(logs, /\[Electron:Renderer:app2\].*\[Test\].*App2 renderer only log/i);

    // Verify both types exist
    const mainProcessLogs = findLogEntries(logs, /\[Electron:MainProcess:(app1|app2)\]/i);
    const rendererLogs = findLogEntries(logs, /\[Electron:Renderer:(app1|app2)\]/i);
    console.log(`[DEBUG] Found ${mainProcessLogs.length} main process and ${rendererLogs.length} renderer log entries`);
    expect(mainProcessLogs.length).toBeGreaterThan(0);
    expect(rendererLogs.length).toBeGreaterThan(0);
  });

  it('should apply different log levels per instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const app1 = multi.getInstance('app1');
    const app2 = multi.getInstance('app2');

    // Generate logs at different levels on both instances
    await Promise.all([
      app1.electron.execute(() => {
        console.debug('[Test] App1 DEBUG log');
        console.info('[Test] App1 INFO log');
      }),
      app2.electron.execute(() => {
        console.debug('[Test] App2 DEBUG log');
        console.info('[Test] App2 INFO log');
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const logDir = path.join(__dirname, '..', '..', '..', 'logs');
    const logs = readWdioLogs(logDir);

    // With default 'info' level, DEBUG should be filtered out
    const debugLogs = findLogEntries(logs, /\[Electron:MainProcess:(app1|app2)\].*DEBUG/i);
    expect(debugLogs.length).toBe(0);

    // INFO logs should be present for both instances
    assertLogContains(logs, /\[Electron:MainProcess:app1\].*INFO/i);
    assertLogContains(logs, /\[Electron:MainProcess:app2\].*INFO/i);
  });
});
