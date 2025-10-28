import { expect } from 'chai';

describe('Tauri Commands', () => {
  it('should execute basic Tauri commands', async () => {
    // Test basic command execution using generic execute pattern
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

  it('should execute commands with parameters', async () => {
    // Test file write command with parameters
    const testPath = `/tmp/tauri-test-${Date.now()}.txt`;
    const testContent = 'Hello, Tauri!';
    const result = await browser.tauri.execute('write_file', testPath, testContent);
    expect(result.success).to.be.true;

    // Verify with read
    const readResult = await browser.tauri.execute('read_file', testPath);
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(testContent);

    // Cleanup
    await browser.tauri.execute('delete_file', testPath);
  });
});
