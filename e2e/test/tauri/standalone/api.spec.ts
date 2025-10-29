import { expect } from 'chai';

describe('Tauri Standalone API', () => {
  it('should initialize Tauri service in standalone mode', async () => {
    // Test that the Tauri service is properly initialized
    expect(browser.tauri).to.exist;
    expect(browser.tauri.execute).to.be.a('function');
  });

  it('should execute commands in standalone mode', async () => {
    // Verify execute() works in standalone mode
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('os');
  });
});
