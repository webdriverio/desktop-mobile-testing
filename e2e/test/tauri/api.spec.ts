import { expect } from 'chai';

describe('Tauri API', () => {
  it('should execute basic commands', async () => {
    // Test basic command execution using the execute API
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('os');
    expect(result.data).to.have.property('arch');
    expect(result.data).to.have.property('hostname');
    expect(result.data).to.have.property('memory');
    expect(result.data).to.have.property('cpu');
  });

  it('should handle command errors gracefully', async () => {
    // Test error handling for invalid commands
    const result = await browser.tauri.execute('invalid_command');
    expect(result.success).to.be.false;
    expect(result.error).to.be.a('string');
  });

  it.skip('should execute commands with parameters', async () => {
    // TODO: Fix parameter passing issues - commands are not reaching Rust layer
    // Skipping until we can resolve the underlying invoke mechanism
  });
});
