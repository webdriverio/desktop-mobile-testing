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

  it('should execute commands with parameters', async () => {
    // First, check the current working directory
    console.log('🔍 Testing get_current_dir command');
    const dirResult = await browser.tauri.execute('get_current_dir');
    console.log('🔍 get_current_dir result:', JSON.stringify(dirResult, null, 2));
    expect(dirResult.success).to.be.true;
    console.log('🔍 Current working directory:', dirResult.data);

    // Test file write command with parameters
    // Use an absolute path to avoid working directory issues
    const testPath = `/tmp/tauri-test-${Date.now()}.txt`;
    const testContent = 'Hello, Tauri!';

    console.log('🔍 Testing write_file command with path:', testPath);
    const result = await browser.tauri.execute('write_file', testPath, testContent);
    console.log('🔍 write_file result:', JSON.stringify(result, null, 2));
    expect(result.success).to.be.true;

    // Verify with read
    console.log('🔍 Testing read_file command with path:', testPath);
    const readResult = await browser.tauri.execute('read_file', testPath);
    console.log('🔍 read_file result:', JSON.stringify(readResult, null, 2));
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(testContent);

    // Cleanup
    console.log('🔍 Testing delete_file command with path:', testPath);
    const deleteResult = await browser.tauri.execute('delete_file', testPath);
    console.log('🔍 delete_file result:', JSON.stringify(deleteResult, null, 2));
  });
});
