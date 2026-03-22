import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAutomationPlugin, checkDebugBuild, warnAutomationPlugin } from '../src/pluginValidator.js';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

const { mockWarn, mockDebug } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockDebug: vi.fn(),
}));

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    warn: mockWarn,
    debug: mockDebug,
    info: vi.fn(),
    error: vi.fn(),
  }),
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

  describe('warnAutomationPlugin', () => {
    it('should log warning when plugin is not installed', () => {
      const cargoToml = `
[package]
name = "my-app"

[dependencies]
tauri = { version = "2.0" }
`;
      vi.mocked(readFileSync).mockReturnValue(cargoToml);

      warnAutomationPlugin('/mock/src-tauri');

      expect(mockWarn).toHaveBeenCalled();
      const warnMessage = mockWarn.mock.calls[0][0] as string;
      expect(warnMessage).toContain('not found');
    });

    it('should log warning with details when plugin is not installed', () => {
      const cargoToml = `
[package]
name = "my-app"

[dependencies]
tauri = { version = "2.0" }
`;
      vi.mocked(readFileSync).mockReturnValue(cargoToml);

      warnAutomationPlugin('/mock/src-tauri');

      expect(mockWarn).toHaveBeenCalledTimes(2);
      const detailsMessage = mockWarn.mock.calls[1][0] as string;
      expect(detailsMessage).toContain('cargo add');
    });

    it('should log debug when plugin is installed', () => {
      const cargoToml = `
[package]
name = "my-app"

[dependencies]
tauri-plugin-automation = "2.0"
`;
      vi.mocked(readFileSync).mockReturnValue(cargoToml);

      warnAutomationPlugin('/mock/src-tauri');

      expect(mockDebug).toHaveBeenCalled();
      const debugMessage = mockDebug.mock.calls[0][0] as string;
      expect(debugMessage).toContain('found in Cargo.toml');
      expect(mockWarn).not.toHaveBeenCalled();
    });
  });
});
