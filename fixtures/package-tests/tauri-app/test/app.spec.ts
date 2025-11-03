import { expect } from '@wdio/globals';

describe('Tauri App Example', () => {
  it('should have tauri service available', async () => {
    // Verify the service is loaded
    expect(browser.tauri).toBeDefined();
    expect(typeof browser.tauri.execute).toBe('function');
  });

  it('should be able to call a simple tauri command', async () => {
    // Test a simple command that doesn't require complex setup
    const result = await browser.tauri.execute('get_platform_info');
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.os).toBeDefined();
    expect(result.data?.arch).toBeDefined();
  });

  it('should get platform information with all required fields', async () => {
    const platformInfo = await browser.tauri.execute('get_platform_info');
    expect(platformInfo.success).toBe(true);
    expect(platformInfo.data).toBeDefined();
    expect(Object.hasOwn(platformInfo.data, 'os')).toBe(true);
    expect(Object.hasOwn(platformInfo.data, 'arch')).toBe(true);
    expect(Object.hasOwn(platformInfo.data, 'hostname')).toBe(true);
    expect(Object.hasOwn(platformInfo.data, 'memory')).toBe(true);
    expect(Object.hasOwn(platformInfo.data, 'cpu')).toBe(true);
  });
});
