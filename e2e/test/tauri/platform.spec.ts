import { expect } from 'chai';

describe('Tauri Platform Information', () => {
  it('should get platform information', async () => {
    const result = await browser.tauri.getPlatformInfo();
    expect(result.success).to.be.true;
    expect(result.data).to.have.property('platform');
    expect(result.data).to.have.property('arch');
    expect(result.data).to.have.property('os');
    expect(result.data).to.have.property('family');
  });

  it('should read clipboard content', async () => {
    // First write to clipboard
    const testText = 'Tauri clipboard test';
    let result = await browser.tauri.writeClipboard(testText);
    expect(result.success).to.be.true;

    // Then read from clipboard
    result = await browser.tauri.readClipboard();
    expect(result.success).to.be.true;
    expect(result.data).to.equal(testText);
  });

  it('should write clipboard content', async () => {
    const testText = 'Tauri clipboard write test';
    const result = await browser.tauri.writeClipboard(testText);
    expect(result.success).to.be.true;

    // Verify by reading back
    const readResult = await browser.tauri.readClipboard();
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
      const writeResult = await browser.tauri.writeClipboard(text);
      expect(writeResult.success).to.be.true;

      const readResult = await browser.tauri.readClipboard();
      expect(readResult.success).to.be.true;
      expect(readResult.data).to.equal(text);
    }
  });
});
