import { expect } from 'chai';

describe('Tauri Standalone API', () => {
  it('should initialize Tauri service in standalone mode', async () => {
    // Test that the Tauri service is properly initialized
    expect(browser.tauri).to.exist;
    expect(browser.tauri.execute).to.be.a('function');
  });

  it('should execute basic commands in standalone mode', async () => {
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('os');
  });

  it('should handle window operations in standalone mode', async () => {
    const result = await browser.tauri.execute('get_window_bounds');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('width');
    expect(result.data).to.have.property('height');
  });

  it('should perform file operations in standalone mode', async () => {
    const testContent = 'Standalone Tauri test content';
    const result = await browser.tauri.execute('write_clipboard', testContent);
    expect(result.success).to.be.true;

    const readResult = await browser.tauri.execute('read_clipboard');
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(testContent);
  });
});
