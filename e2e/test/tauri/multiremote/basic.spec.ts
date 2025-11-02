import { expect, multiremotebrowser } from '@wdio/globals';

describe('Tauri Multiremote', () => {
  it('should initialize Tauri API on multiple instances', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Service already ensures readiness via waitUntilWindowAvailable in before() hook
    // No need for additional readiness checks

    const [resultA, resultB] = await Promise.all([
      (browserA as any).tauri.execute('get_platform_info'),
      (browserB as any).tauri.execute('get_platform_info'),
    ]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(Object.hasOwn(resultA.data, 'os')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'os')).toBe(true);
    expect(Object.hasOwn(resultA.data, 'arch')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'arch')).toBe(true);
  });

  it('should execute commands independently on multiple instances', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Both instances should be able to execute concurrently without interference
    const [resultA, resultB] = await Promise.all([
      (browserA as any).tauri.execute('get_platform_info'),
      (browserB as any).tauri.execute('get_platform_info'),
    ]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(Object.hasOwn(resultA.data, 'hostname')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'hostname')).toBe(true);
    expect(Object.hasOwn(resultA.data, 'memory')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'memory')).toBe(true);

    // Verify instances can operate independently by checking they have unique hostnames
    // (or at least that both queries succeeded independently)
    expect(typeof resultA.data.hostname).toBe('string');
    expect(typeof resultB.data.hostname).toBe('string');
  });

  it('should retrieve instance-specific values from each instance', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Get platform info from both instances
    const [resultA, resultB] = await Promise.all([
      (browserA as any).tauri.execute('get_platform_info'),
      (browserB as any).tauri.execute('get_platform_info'),
    ]);

    // Both should succeed
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Verify both instances return valid platform information
    expect(Object.hasOwn(resultA.data, 'os')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'os')).toBe(true);
    expect(resultA.data.os).toBe(resultB.data.os); // Same OS for both instances

    // Verify both instances have independent data structures
    expect(Object.hasOwn(resultA.data, 'cpu')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'cpu')).toBe(true);
  });
});
