import { expect, multiremotebrowser } from '@wdio/globals';

describe('Tauri Multiremote', () => {
  it('should initialize Tauri API on multiple instances', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Readiness: ensure the session is valid and a window is available
    const tauriReady = async (inst: WebdriverIO.Browser) =>
      await inst.waitUntil(
        async () => {
          try {
            await inst.getWindowHandle();
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 30000, interval: 250 },
      );

    await tauriReady(browserA);
    await tauriReady(browserB);

    const [resultA, resultB] = await Promise.all([
      (browserA as any).tauri.execute('get_platform_info'),
      (browserB as any).tauri.execute('get_platform_info'),
    ]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    expect(Object.hasOwn(resultA.data, 'os')).toBe(true);
    expect(Object.hasOwn(resultB.data, 'os')).toBe(true);
  });

  it('should execute commands independently on multiple instances', async () => {
    const multi = multiremotebrowser as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Ensure session/window is established before invoking
    const tauriReady = async (inst: WebdriverIO.Browser) =>
      await inst.waitUntil(
        async () => {
          try {
            await inst.getWindowHandle();
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 30000, interval: 250 },
      );

    await tauriReady(browserA);
    await tauriReady(browserB);

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
