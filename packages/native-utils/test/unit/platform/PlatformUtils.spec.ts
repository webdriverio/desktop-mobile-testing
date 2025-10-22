import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlatformUtils } from '../../../src/platform/PlatformUtils.js';

describe('PlatformUtils', () => {
  describe('getPlatform', () => {
    it('should return current platform', () => {
      const platform = PlatformUtils.getPlatform();
      expect(['darwin', 'win32', 'linux']).toContain(platform);
    });

    it('should match process.platform', () => {
      const platform = PlatformUtils.getPlatform();
      expect(platform).toBe(process.platform);
    });
  });

  describe('getPlatformDisplayName', () => {
    it('should return display name for platform', () => {
      const name = PlatformUtils.getPlatformDisplayName();
      expect(['macOS', 'Windows', 'Linux']).toContain(name);
    });

    it('should return correct name for current platform', () => {
      const platform = PlatformUtils.getPlatform();
      const name = PlatformUtils.getPlatformDisplayName();

      if (platform === 'darwin') expect(name).toBe('macOS');
      if (platform === 'win32') expect(name).toBe('Windows');
      if (platform === 'linux') expect(name).toBe('Linux');
    });
  });

  describe('getBinaryExtension', () => {
    it('should return binary extension for platform', () => {
      const ext = PlatformUtils.getBinaryExtension();
      expect(['.exe', '.app', '']).toContain(ext);
    });

    it('should return correct extension for current platform', () => {
      const platform = PlatformUtils.getPlatform();
      const ext = PlatformUtils.getBinaryExtension();

      if (platform === 'win32') expect(ext).toBe('.exe');
      if (platform === 'darwin') expect(ext).toBe('.app');
      if (platform === 'linux') expect(ext).toBe('');
    });
  });

  describe('getArchitecture', () => {
    it('should return architecture', () => {
      const arch = PlatformUtils.getArchitecture();
      expect(arch).toBe(process.arch);
      expect(arch).toBeDefined();
      expect(typeof arch).toBe('string');
    });
  });

  describe('normalizePath', () => {
    it('should normalize paths', () => {
      const normalized = PlatformUtils.normalizePath('some/path//to/../file');
      expect(normalized).toBeDefined();
      // Normalized path should not have double slashes or ..
      expect(normalized).not.toContain('//');
    });

    it('should handle backslashes', () => {
      const normalized = PlatformUtils.normalizePath('some\\path\\to\\file');
      expect(normalized).toBeDefined();
    });

    it('should handle mixed separators', () => {
      const normalized = PlatformUtils.normalizePath('some/path\\to/file');
      expect(normalized).toBeDefined();
    });
  });

  describe('isCI', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      // Restore original environment
      process.env = { ...originalEnv };
    });

    it('should return boolean', () => {
      const result = PlatformUtils.isCI();
      expect(typeof result).toBe('boolean');
    });

    it('should detect CI=true', () => {
      process.env.CI = 'true';
      expect(PlatformUtils.isCI()).toBe(true);
    });

    it('should detect GITHUB_ACTIONS', () => {
      delete process.env.CI;
      process.env.GITHUB_ACTIONS = 'true';
      expect(PlatformUtils.isCI()).toBe(true);
    });

    it('should detect GITLAB_CI', () => {
      delete process.env.CI;
      process.env.GITLAB_CI = 'true';
      expect(PlatformUtils.isCI()).toBe(true);
    });

    it('should return false when not in CI', () => {
      delete process.env.CI;
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITLAB_CI;
      delete process.env.CIRCLECI;
      delete process.env.TRAVIS;
      delete process.env.BUILD_NUMBER;
      delete process.env.CONTINUOUS_INTEGRATION;

      expect(PlatformUtils.isCI()).toBe(false);
    });
  });

  describe('getNodeVersion', () => {
    it('should return Node version', () => {
      const version = PlatformUtils.getNodeVersion();
      expect(version).toBe(process.version);
      expect(version).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

  describe('sanitizeAppNameForPath', () => {
    it('should convert spaces to hyphens on Linux', () => {
      const result = PlatformUtils.sanitizeAppNameForPath('My App Name', 'linux');
      expect(result).toBe('my-app-name');
    });

    it('should preserve spaces on macOS', () => {
      const result = PlatformUtils.sanitizeAppNameForPath('My App Name', 'darwin');
      expect(result).toBe('My App Name');
    });

    it('should preserve spaces on Windows', () => {
      const result = PlatformUtils.sanitizeAppNameForPath('My App Name', 'win32');
      expect(result).toBe('My App Name');
    });

    it('should use current platform when not specified', () => {
      const result = PlatformUtils.sanitizeAppNameForPath('My App Name');
      expect(result).toBeDefined();

      const platform = PlatformUtils.getPlatform();
      if (platform === 'linux') {
        expect(result).toBe('my-app-name');
      } else {
        expect(result).toBe('My App Name');
      }
    });

    it('should handle multiple spaces', () => {
      const result = PlatformUtils.sanitizeAppNameForPath('My   App   Name', 'linux');
      expect(result).toBe('my---app---name');
    });
  });

  describe('getPathSeparator', () => {
    it('should return path separator', () => {
      const sep = PlatformUtils.getPathSeparator();
      expect(['/', '\\\\'].includes(sep)).toBe(true);
    });

    it('should match path.sep', () => {
      const sep = PlatformUtils.getPathSeparator();
      expect(sep).toBe(path.sep);
    });
  });

  describe('getEnvVar', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.TEST_VAR = 'test-value';
    });

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should get environment variable', () => {
      const value = PlatformUtils.getEnvVar('TEST_VAR');
      expect(value).toBe('test-value');
    });

    it('should return default value when variable not set', () => {
      const value = PlatformUtils.getEnvVar('NONEXISTENT_VAR', 'default');
      expect(value).toBe('default');
    });

    it('should return undefined when variable not set and no default', () => {
      const value = PlatformUtils.getEnvVar('NONEXISTENT_VAR');
      expect(value).toBeUndefined();
    });
  });

  describe('isSupportedPlatform', () => {
    it('should return true for darwin', () => {
      expect(PlatformUtils.isSupportedPlatform('darwin')).toBe(true);
    });

    it('should return true for win32', () => {
      expect(PlatformUtils.isSupportedPlatform('win32')).toBe(true);
    });

    it('should return true for linux', () => {
      expect(PlatformUtils.isSupportedPlatform('linux')).toBe(true);
    });

    it('should return false for unsupported platforms', () => {
      expect(PlatformUtils.isSupportedPlatform('freebsd')).toBe(false);
      expect(PlatformUtils.isSupportedPlatform('sunos')).toBe(false);
      expect(PlatformUtils.isSupportedPlatform('aix')).toBe(false);
    });
  });

  describe('getHomeDirectory', () => {
    it('should return home directory', () => {
      const home = PlatformUtils.getHomeDirectory();
      expect(home).toBeDefined();
      expect(typeof home).toBe('string');
      expect(home.length).toBeGreaterThan(0);
    });
  });

  describe('getTempDirectory', () => {
    it('should return temp directory', () => {
      const temp = PlatformUtils.getTempDirectory();
      expect(temp).toBeDefined();
      expect(typeof temp).toBe('string');
      expect(temp.length).toBeGreaterThan(0);
    });
  });
});
