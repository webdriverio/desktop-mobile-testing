import { expect } from '@wdio/globals';
import '@wdio/native-types';

describe('Tauri App Example', () => {
  it('should have tauri service available', async () => {
    // Verify the service is loaded
    expect(browser.tauri).toBeDefined();
    expect(typeof browser.tauri.execute).toBe('function');
  });

  it('should be able to call a simple tauri command', async () => {
    // Test a simple command that doesn't require complex setup
    const result = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));
    expect(result).toBeDefined();
    expect(result).toHaveProperty('os');
    expect(result).toHaveProperty('arch');
  });

  it('should get platform information with all required fields', async () => {
    const platformInfo = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));
    expect(platformInfo).toBeDefined();
    expect(Object.hasOwn(platformInfo, 'os')).toBe(true);
    expect(Object.hasOwn(platformInfo, 'arch')).toBe(true);
    expect(Object.hasOwn(platformInfo, 'hostname')).toBe(true);
    expect(Object.hasOwn(platformInfo, 'memory')).toBe(true);
    expect(Object.hasOwn(platformInfo, 'cpu')).toBe(true);
  });
});
