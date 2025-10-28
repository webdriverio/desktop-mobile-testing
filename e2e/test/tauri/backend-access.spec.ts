import { expect } from 'chai';

describe('Tauri Backend Access', () => {
  it('should execute Rust backend commands', async () => {
    // Test basic backend command execution with get_platform_info
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('os');
    expect(result.data).to.have.property('arch');
    expect(result.data).to.have.property('hostname');
    expect(result.data).to.have.property('memory');
    expect(result.data.memory).to.have.property('total');
    expect(result.data.memory).to.have.property('free');
    expect(result.data).to.have.property('cpu');
    expect(result.data.cpu).to.have.property('cores');
  });

  it('should handle backend command with parameters', async () => {
    // Test backend command with parameters using write_file/read_file
    const testPath = `/tmp/tauri-backend-test-${Date.now()}.txt`;
    const testContent = 'Backend test content';

    const writeResult = await browser.tauri.execute('write_file', testPath, testContent);
    expect(writeResult.success).to.be.true;

    const readResult = await browser.tauri.execute('read_file', testPath);
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(testContent);

    // Cleanup
    await browser.tauri.execute('delete_file', testPath);
  });

  it('should execute complex backend operations', async () => {
    // Test more complex backend operations with clipboard
    const testTexts = ['First', 'Second', 'Third'];

    for (const text of testTexts) {
      const writeResult = await browser.tauri.execute('write_clipboard', text);
      expect(writeResult.success).to.be.true;

      const readResult = await browser.tauri.execute('read_clipboard');
      expect(readResult.success).to.be.true;
      expect(readResult.data).to.equal(text);
    }
  });

  it('should handle backend errors gracefully', async () => {
    // Test error handling for backend operations - try to read non-existent file
    const result = await browser.tauri.execute('read_file', '/nonexistent/path/file.txt');
    expect(result.success).to.be.false;
    expect(result.error).to.be.a('string');
  });

  it('should execute async backend operations', async () => {
    // Test async backend operations using clipboard
    const result = await browser.tauri.execute('write_clipboard', 'Async test');
    expect(result.success).to.be.true;

    const readResult = await browser.tauri.execute('read_clipboard');
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal('Async test');
  });

  it('should handle invalid command gracefully', async () => {
    // Test that invalid commands return proper error structure
    const result = await browser.tauri.execute('nonexistent_command');
    expect(result.success).to.be.false;
    expect(result.error).to.be.a('string');
  });
});
