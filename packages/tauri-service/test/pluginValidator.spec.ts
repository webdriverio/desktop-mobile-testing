import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAutomationPlugin, checkDebugBuild } from '../src/pluginValidator.js';

// Mock fs
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

describe('Plugin Validator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkAutomationPlugin', () => {
    it('should detect plugin when present in Cargo.toml', () => {
      const cargoToml = `
[package]
name = "my-app"
version = "1.0.0"

[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-automation = "2.0"
`;
      vi.mocked(readFileSync).mockReturnValue(cargoToml);

      const result = checkAutomationPlugin('/mock/src-tauri');

      expect(result.installed).toBe(true);
      expect(result.message).toContain('found in Cargo.toml');
    });

    it('should return not installed when plugin missing', () => {
      const cargoToml = `
[package]
name = "my-app"

[dependencies]
tauri = { version = "2.0" }
`;
      vi.mocked(readFileSync).mockReturnValue(cargoToml);

      const result = checkAutomationPlugin('/mock/src-tauri');

      expect(result.installed).toBe(false);
      expect(result.message).toContain('not found');
      expect(result.details).toContain('cargo add');
    });

    it('should handle file read errors', () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file');
      });

      const result = checkAutomationPlugin('/mock/src-tauri');

      expect(result.installed).toBe(false);
      expect(result.message).toContain('Could not read Cargo.toml');
    });
  });

  describe('checkDebugBuild', () => {
    it('should detect debug build from path (Unix)', () => {
      const result = checkDebugBuild('/path/to/src-tauri/target/debug/my-app');

      expect(result.installed).toBe(true);
      expect(result.message).toContain('debug build');
    });

    it('should detect debug build from path (Windows)', () => {
      const result = checkDebugBuild('C:\\path\\to\\src-tauri\\target\\debug\\my-app.exe');

      expect(result.installed).toBe(true);
      expect(result.message).toContain('debug build');
    });

    it('should warn for release build path', () => {
      const result = checkDebugBuild('/path/to/src-tauri/target/release/my-app');

      expect(result.installed).toBe(false);
      expect(result.message).toContain('not appear to be a debug build');
      expect(result.details).toContain('cargo build');
    });
  });
});
