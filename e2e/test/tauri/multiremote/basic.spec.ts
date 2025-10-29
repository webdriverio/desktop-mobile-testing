import { expect, multiremotebrowser } from '@wdio/globals';

describe('Tauri Multiremote', () => {
  it('should initialize Tauri API on multiple instances', async () => {
    // Root multiremote object should have tauri API that fans out to instances
    const results = await (browser as any).tauri.execute('get_platform_info');
    // Expect an array of results from both instances
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(Object.hasOwn(results[0].data, 'os')).toBe(true);
    expect(Object.hasOwn(results[1].data, 'os')).toBe(true);
  });

  it('should execute commands independently on multiple instances', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    const [resultA, resultB] = await Promise.all([
      (browserA as any).tauri.execute('get_platform_info'),
      (browserB as any).tauri.execute('get_platform_info'),
    ]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(Object.hasOwn(resultA.data, 'hostname')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'hostname')).toBe(true);

    // Both instances should be able to execute without interfering with each other
    // We don't assert differences in values, only that both are independently successful
  });
});
