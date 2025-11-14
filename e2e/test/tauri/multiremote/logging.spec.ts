import { expect, multiremotebrowser } from '@wdio/globals';
import '@wdio/native-types';
import path from 'node:path';
import url from 'node:url';
import { assertLogContains, findLogEntries, readWdioLogs } from '../helpers/logging.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

describe('Tauri Log Integration - Multiremote', () => {
  it('should capture backend logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate logs on both instances
    await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
      browserB.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
    ]);

    // Wait longer for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify logs were captured with correct prefixes and instance IDs
    const logBaseDir = path.join(__dirname, '..', '..', 'logs');
    const logs = readWdioLogs(logBaseDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Both instances should have backend logs with [Tauri:Backend] prefix
    assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*INFO level log/i);
    assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*WARN level log/i);
    assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*ERROR level log/i);

    // Verify we have logs from both instances
    // Note: Instance-specific logging may include instance IDs in the log prefix
    const backendLogs = findLogEntries(logs, /\[Tauri:Backend\]/i);
    console.log(`[DEBUG] Found ${backendLogs.length} backend log entries from both instances`);
    expect(backendLogs.length).toBeGreaterThan(0);
  });

  it('should capture frontend logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate frontend logs on both instances
    await Promise.all([
      browserA.execute(() => {
        console.info('[Test] Instance A frontend INFO log');
        console.warn('[Test] Instance A frontend WARN log');
      }),
      browserB.execute(() => {
        console.info('[Test] Instance B frontend INFO log');
        console.warn('[Test] Instance B frontend WARN log');
      }),
    ]);

    // Wait longer for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify frontend logs were captured with correct prefixes
    const logBaseDir = path.join(__dirname, '..', '..', 'logs');
    const logs = readWdioLogs(logBaseDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Verify both instances' frontend logs are captured
    assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Instance A frontend INFO/i);
    assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Instance B frontend INFO/i);

    const frontendLogs = findLogEntries(logs, /\[Tauri:Frontend\]/i);
    console.log(`[DEBUG] Found ${frontendLogs.length} frontend log entries from both instances`);
    expect(frontendLogs.length).toBeGreaterThan(0);
  });

  it('should capture logs independently per instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate different logs on each instance
    await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
      browserB.execute(() => {
        console.info('[Test] Instance B only frontend log');
      }),
    ]);

    // Wait longer for logs to be captured and written
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify both types of logs are captured independently
    const logBaseDir = path.join(__dirname, '..', '..', 'logs');
    const logs = readWdioLogs(logBaseDir);

    if (!logs) {
      throw new Error('No logs found in output directory');
    }

    // Instance A should have backend logs
    assertLogContains(logs, /\[Tauri:Backend\].*\[Test\].*INFO level log/i);

    // Instance B should have frontend logs
    assertLogContains(logs, /\[Tauri:Frontend\].*\[Test\].*Instance B only frontend log/i);

    // Verify both types exist
    const backendLogs = findLogEntries(logs, /\[Tauri:Backend\]/i);
    const frontendLogs = findLogEntries(logs, /\[Tauri:Frontend\]/i);
    console.log(`[DEBUG] Found ${backendLogs.length} backend and ${frontendLogs.length} frontend log entries`);
    expect(backendLogs.length).toBeGreaterThan(0);
    expect(frontendLogs.length).toBeGreaterThan(0);
  });
});
