import { expect } from 'chai';

describe('Tauri Commands', () => {
  it('should execute basic Tauri commands', async () => {
    // Test basic command execution using generic execute pattern
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('platform');
    expect(result.data).to.have.property('arch');
  });

  it('should handle command errors gracefully', async () => {
    // Test error handling for invalid commands
    const result = await browser.tauri.execute('invalid_command');
    expect(result.success).to.be.false;
    expect(result.error).to.be.a('string');
  });

  it('should execute commands with parameters', async () => {
    // Test command with parameters
    const result = await browser.tauri.execute('echo', { message: 'Hello, Tauri!' });
    expect(result.success).to.be.true;
    expect(result.data).to.equal('Hello, Tauri!');
  });
});
