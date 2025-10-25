import { expect } from '@wdio/globals';

describe('Tauri Basic App - Basic Functionality', () => {
  it('should get window bounds using execute', async () => {
    const bounds = await browser.tauri.execute('get_window_bounds');
    expect(bounds.success).toBe(true);
    expect(bounds.data).toBeDefined();
    expect(bounds.data?.width).toBeGreaterThan(0);
    expect(bounds.data?.height).toBeGreaterThan(0);
  });

  it('should set window bounds using execute', async () => {
    // Get original bounds
    const originalBounds = await browser.tauri.execute('get_window_bounds');
    expect(originalBounds.success).toBe(true);

    // Set new bounds
    const newBounds = { x: 100, y: 100, width: 500, height: 400 };
    const setResult = await browser.tauri.execute('set_window_bounds', newBounds);
    expect(setResult.success).toBe(true);

    // Verify new bounds
    const updatedBounds = await browser.tauri.execute('get_window_bounds');
    expect(updatedBounds.success).toBe(true);
    expect(updatedBounds.data?.x).toBe(100);
    expect(updatedBounds.data?.y).toBe(100);
    expect(updatedBounds.data?.width).toBe(500);
    expect(updatedBounds.data?.height).toBe(400);

    // Restore original bounds
    if (originalBounds.data) {
      await browser.tauri.execute('set_window_bounds', originalBounds.data);
    }
  });

  it('should get platform information using execute', async () => {
    const platformInfo = await browser.tauri.execute('get_platform_info');
    expect(platformInfo.success).toBe(true);
    expect(platformInfo.data).toBeDefined();
    expect(platformInfo.data?.os).toBeDefined();
    expect(platformInfo.data?.arch).toBeDefined();
    expect(platformInfo.data?.version).toBeDefined();
    expect(platformInfo.data?.hostname).toBeDefined();
    expect(platformInfo.data?.memory).toBeDefined();
    expect(platformInfo.data?.cpu).toBeDefined();
    expect(platformInfo.data?.disk).toBeDefined();

    // Verify data types
    expect(typeof platformInfo.data?.os).toBe('string');
    expect(typeof platformInfo.data?.arch).toBe('string');
    expect(typeof platformInfo.data?.memory.total).toBe('number');
    expect(typeof platformInfo.data?.cpu.cores).toBe('number');
  });

  it('should read and write a file using execute', async () => {
    const filePath = './test_file.txt';
    const fileContent = 'Hello from Tauri Basic App!';

    // Write file
    const writeResult = await browser.tauri.execute('write_file', filePath, fileContent);
    expect(writeResult.success).toBe(true);

    // Read file
    const readResult = await browser.tauri.execute('read_file', filePath);
    expect(readResult.success).toBe(true);
    expect(readResult.data).toBe(fileContent);

    // Clean up
    const deleteResult = await browser.tauri.execute('delete_file', filePath);
    expect(deleteResult.success).toBe(true);
  });

  it('should read and write clipboard using execute', async () => {
    const clipboardContent = 'Tauri Basic App clipboard test';

    // Write to clipboard
    const writeResult = await browser.tauri.execute('write_clipboard', clipboardContent);
    expect(writeResult.success).toBe(true);

    // Read from clipboard
    const readResult = await browser.tauri.execute('read_clipboard');
    expect(readResult.success).toBe(true);
    expect(readResult.data).toBe(clipboardContent);
  });

  // DISABLED: Complex window operations - will implement later
  it.skip('should minimize and restore window', async () => {
    // Minimize window
    const minimizeResult = await browser.tauri.execute('minimize_window');
    expect(minimizeResult.success).toBe(true);

    // Wait a bit for the minimize animation
    await browser.pause(1000);

    // Unmaximize (which also restores from minimize)
    const unmaximizeResult = await browser.tauri.execute('unmaximize_window');
    expect(unmaximizeResult.success).toBe(true);

    // Wait for restore
    await browser.pause(1000);

    // Verify window is still functional
    const bounds = await browser.tauri.execute('get_window_bounds');
    expect(bounds.success).toBe(true);
  });

  it.skip('should maximize and unmaximize window', async () => {
    // Get original bounds
    const originalBounds = await browser.tauri.execute('get_window_bounds');
    expect(originalBounds.success).toBe(true);

    // Maximize window
    const maximizeResult = await browser.tauri.execute('maximize_window');
    expect(maximizeResult.success).toBe(true);

    // Wait for maximize animation
    await browser.pause(1000);

    // Unmaximize window
    const unmaximizeResult = await browser.tauri.execute('unmaximize_window');
    expect(unmaximizeResult.success).toBe(true);

    // Wait for unmaximize animation
    await browser.pause(1000);

    // Verify bounds are restored
    const restoredBounds = await browser.tauri.execute('get_window_bounds');
    expect(restoredBounds.success).toBe(true);
    expect(restoredBounds.data?.x).toBe(originalBounds.data?.x);
    expect(restoredBounds.data?.y).toBe(originalBounds.data?.y);
  });

  it.skip('should take a screenshot', async () => {
    const screenshot = await browser.tauri.execute('take_screenshot');
    expect(screenshot.success).toBe(true);
    expect(screenshot.data).toBeDefined();
    expect(screenshot.data?.length).toBeGreaterThan(100); // Base64 string should be long
    expect(screenshot.data).toMatch(/^data:image\//); // Should be a data URL
  });
});
