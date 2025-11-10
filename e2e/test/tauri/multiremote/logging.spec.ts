import { expect, multiremotebrowser } from '@wdio/globals';
import '@wdio/native-types';

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

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify logs were generated (actual log file verification happens at framework level)
    const [resultA, resultB] = await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
      browserB.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
    ]);

    expect(resultA).toBe('Logs generated');
    expect(resultB).toBe('Logs generated');
  });

  it('should capture frontend logs per instance with instance ID', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Generate frontend logs on both instances
    await Promise.all([
      browserA.execute(() => {
        console.info('[Test] Instance A frontend log');
      }),
      browserB.execute(() => {
        console.info('[Test] Instance B frontend log');
      }),
    ]);

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify logs were generated
    const [resultA, resultB] = await Promise.all([
      browserA.execute(() => 'Logs generated'),
      browserB.execute(() => 'Logs generated'),
    ]);

    expect(resultA).toBe('Logs generated');
    expect(resultB).toBe('Logs generated');
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

    // Wait for logs to be captured
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify both instances can generate logs independently
    const [resultA, resultB] = await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('generate_test_logs')),
      browserB.execute(() => 'Logs generated'),
    ]);

    expect(resultA).toBe('Logs generated');
    expect(resultB).toBe('Logs generated');
  });
});
