import { expect } from 'chai';

describe('Tauri Platform Information', () => {
  it('should get platform information', async () => {
    const result = await browser.tauri.execute('get_platform_info');
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('os');
    expect(result.data).to.have.property('arch');
    expect(result.data).to.have.property('version');
    expect(result.data).to.have.property('hostname');
    expect(result.data).to.have.property('memory');
    expect(result.data).to.have.property('cpu');
    expect(result.data).to.have.property('disk');
  });

  it('should read clipboard content', async () => {
    // First write to clipboard
    const testText = 'Tauri clipboard test';
    let result = await browser.tauri.execute('write_clipboard', testText);
    expect(result.success).to.be.true;

    // Then read from clipboard
    result = await browser.tauri.execute('read_clipboard');
    expect(result.success).to.be.true;
    expect(result.data).to.equal(testText);
  });

  it('should write clipboard content', async () => {
    const testText = 'Tauri clipboard write test';
    const result = await browser.tauri.execute('write_clipboard', testText);
    expect(result.success).to.be.true;

    // Verify by reading back
    const readResult = await browser.tauri.execute('read_clipboard');
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(testText);
  });

  it('should handle clipboard operations with different content types', async () => {
    const testTexts = [
      'Simple text',
      'Text with special characters: !@#$%^&*()',
      'Multiline\ntext\nwith\nnewlines',
      'Unicode: 🚀 Tauri is awesome! 🎉',
    ];

    for (const text of testTexts) {
      const writeResult = await browser.tauri.execute('write_clipboard', text);
      expect(writeResult.success).to.be.true;

      const readResult = await browser.tauri.execute('read_clipboard');
      expect(readResult.success).to.be.true;
      expect(readResult.data).to.equal(text);
    }
  });
});
