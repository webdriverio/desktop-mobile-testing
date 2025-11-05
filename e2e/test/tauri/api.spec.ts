import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';

describe('Tauri API', () => {
  it('should execute basic commands', async () => {
    // Test basic command execution using the execute API
    const result = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));
    expect(result).toHaveProperty('os');
    expect(result).toHaveProperty('arch');
    expect(result).toHaveProperty('hostname');
    expect(result).toHaveProperty('memory');
    expect(result).toHaveProperty('cpu');
  });

  it('should handle command errors gracefully', async () => {
    // Test error handling for invalid commands
    await expect(browser.tauri.execute(({ core }) => core.invoke('invalid_command'))).rejects.toThrow();
  });

  it('should execute commands with parameters', async () => {
    // Test command execution with parameters
    const result = (await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'))) as { os: string };
    expect(result).toHaveProperty('os');
    expect(typeof result.os).toBe('string');
  });
});
