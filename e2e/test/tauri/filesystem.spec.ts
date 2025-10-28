import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';

describe('Tauri Filesystem Operations', () => {
  let testFilePath: string;

  beforeEach(() => {
    // Create a temporary test file
    testFilePath = join(tmpdir(), `tauri-test-${Date.now()}.txt`);
    writeFileSync(testFilePath, 'Hello, Tauri!');
  });

  afterEach(() => {
    // Clean up test file
    try {
      unlinkSync(testFilePath);
    } catch (_error) {
      // File might not exist, ignore error
    }
  });

  it('should read file content', async () => {
    const result = await browser.tauri.execute('read_file', testFilePath);
    expect(result.success).to.be.true;
    expect(result.data).to.equal('Hello, Tauri!');
  });

  it('should write file content', async () => {
    const newContent = 'Updated content from Tauri test';
    const result = await browser.tauri.execute('write_file', testFilePath, newContent);
    expect(result.success).to.be.true;

    // Verify the content was written
    const readResult = await browser.tauri.execute('read_file', testFilePath);
    expect(readResult.success).to.be.true;
    expect(readResult.data).to.equal(newContent);
  });

  it('should delete file', async () => {
    const result = await browser.tauri.execute('delete_file', testFilePath);
    expect(result.success).to.be.true;

    // Verify the file was deleted
    const readResult = await browser.tauri.execute('read_file', testFilePath);
    expect(readResult.success).to.be.false;
  });

  it('should handle file operations with options', async () => {
    const result = await browser.tauri.execute('write_file', testFilePath, 'Content with options', {
      encoding: 'utf8',
    });
    expect(result.success).to.be.true;
  });
});
