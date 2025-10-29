import { expect } from '@wdio/globals';

describe('Tauri Basic App - Basic Service Test', () => {
  it('should have tauri service available', async () => {
    // Just verify the service is loaded
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
  });
});
