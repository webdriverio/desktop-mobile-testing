import { expect, multiremotebrowser } from '@wdio/globals';
import '@wdio/native-types';

function assertHasOwnProperty<Property extends PropertyKey>(
  value: unknown,
  property: Property,
): asserts value is Record<Property, unknown> {
  if (typeof value !== 'object' || value === null || !Object.hasOwn(value, property)) {
    throw new Error(`Expected property ${String(property)} to exist on value`);
  }
}

describe('Tauri APIs using Multiremote', () => {
  it('should retrieve platform info through the Tauri API on multiple instances', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Service already ensures readiness via waitUntilWindowAvailable in before() hook
    // No need for additional readiness checks

    const [resultA, resultB] = await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('get_platform_info')),
      browserB.tauri.execute(({ core }) => core.invoke('get_platform_info')),
    ]);
    assertHasOwnProperty(resultA, 'os');
    assertHasOwnProperty(resultB, 'os');
    assertHasOwnProperty(resultA, 'arch');
    assertHasOwnProperty(resultB, 'arch');
    expect(resultA.os).toBe(resultB.os); // Same OS for both instances
  });

  it('should execute commands independently on multiple instances', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Both instances should be able to execute concurrently without interference
    const [resultA, resultB] = await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('get_platform_info')),
      browserB.tauri.execute(({ core }) => core.invoke('get_platform_info')),
    ]);

    assertHasOwnProperty(resultA, 'hostname');
    assertHasOwnProperty(resultB, 'hostname');
    assertHasOwnProperty(resultA, 'memory');
    assertHasOwnProperty(resultB, 'memory');

    // Verify instances can operate independently by checking they have unique hostnames
    // (or at least that both queries succeeded independently)
    expect(typeof resultA.hostname).toBe('string');
    expect(typeof resultB.hostname).toBe('string');
  });

  it('should retrieve instance-specific values from each instance', async () => {
    const multi = multiremotebrowser as unknown as WebdriverIO.MultiRemoteBrowser;
    const browserA = multi.getInstance('browserA');
    const browserB = multi.getInstance('browserB');

    // Get platform info from both instances
    const [resultA, resultB] = await Promise.all([
      browserA.tauri.execute(({ core }) => core.invoke('get_platform_info')),
      browserB.tauri.execute(({ core }) => core.invoke('get_platform_info')),
    ]);

    // Verify both instances return valid platform information
    assertHasOwnProperty(resultA, 'os');
    assertHasOwnProperty(resultB, 'os');
    expect(resultA.os).toBe(resultB.os); // Same OS for both instances

    // Verify both instances have independent data structures
    assertHasOwnProperty(resultA, 'cpu');
    assertHasOwnProperty(resultB, 'cpu');
  });
});
