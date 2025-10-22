import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigReader } from '../../../src/configuration/ConfigReader.js';

describe('ConfigReader', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `config-reader-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('JSON config files', () => {
    it('should read a simple JSON config', async () => {
      const configPath = join(testDir, 'config.json');
      await writeFile(configPath, JSON.stringify({ appName: 'TestApp', version: '1.0.0' }));

      const reader = new ConfigReader({ filePatterns: ['config.json'] });
      const result = await reader.read(testDir);

      expect(result.config).toEqual({ appName: 'TestApp', version: '1.0.0' });
      expect(result.configFile).toBe('config.json');
    });

    it('should read JSON5 with comments', async () => {
      const configPath = join(testDir, 'config.json5');
      await writeFile(
        configPath,
        `{
        // This is a comment
        appName: 'TestApp', // Trailing commas allowed
      }`,
      );

      const reader = new ConfigReader({ filePatterns: ['config.json5'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
    });
  });

  describe('YAML config files', () => {
    it('should read a YAML config', async () => {
      const configPath = join(testDir, 'config.yaml');
      await writeFile(
        configPath,
        `appName: TestApp
version: 1.0.0
features:
  - feature1
  - feature2`,
      );

      const reader = new ConfigReader({ filePatterns: ['config.yaml'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
      expect(result.config).toHaveProperty('version', '1.0.0');
      expect((result.config as any).features).toEqual(['feature1', 'feature2']);
    });

    it('should read a .yml file', async () => {
      const configPath = join(testDir, 'config.yml');
      await writeFile(configPath, `appName: TestApp`);

      const reader = new ConfigReader({ filePatterns: ['config.yml'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
    });
  });

  describe('TOML config files', () => {
    it('should read a TOML config', async () => {
      const configPath = join(testDir, 'config.toml');
      await writeFile(
        configPath,
        `appName = "TestApp"
version = "1.0.0"

[features]
enabled = true`,
      );

      const reader = new ConfigReader({ filePatterns: ['config.toml'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
      expect(result.config).toHaveProperty('version', '1.0.0');
      expect((result.config as any).features).toHaveProperty('enabled', true);
    });
  });

  describe('JavaScript config files', () => {
    it('should read a .js file with default export', async () => {
      const configPath = join(testDir, 'config.js');
      await writeFile(configPath, `export default { appName: 'TestApp' };`);

      const reader = new ConfigReader({ filePatterns: ['config.js'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
    });

    it('should read a .mjs file', async () => {
      const configPath = join(testDir, 'config.mjs');
      await writeFile(configPath, `export default { appName: 'TestApp' };`);

      const reader = new ConfigReader({ filePatterns: ['config.mjs'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
    });

    it('should handle function exports', async () => {
      const configPath = join(testDir, 'config.js');
      await writeFile(configPath, `export default () => ({ appName: 'DynamicApp' });`);

      const reader = new ConfigReader({ filePatterns: ['config.js'] });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'DynamicApp');
    });
  });

  describe('File pattern matching', () => {
    it('should try multiple patterns and use first found', async () => {
      const configPath = join(testDir, '.apprc.json');
      await writeFile(configPath, JSON.stringify({ appName: 'TestApp' }));

      const reader = new ConfigReader({
        filePatterns: ['missing.json', 'also-missing.json', '.apprc.json'],
      });
      const result = await reader.read(testDir);

      expect(result.config).toHaveProperty('appName', 'TestApp');
      expect(result.configFile).toBe('.apprc.json');
    });

    it('should throw error when no config file found', async () => {
      const reader = new ConfigReader({
        filePatterns: ['missing.json', 'not-there.yaml'],
      });

      await expect(reader.read(testDir)).rejects.toThrow('No config file found');
    });
  });

  describe('Schema validation', () => {
    it('should validate config with schema', async () => {
      const configPath = join(testDir, 'config.json');
      await writeFile(configPath, JSON.stringify({ appName: 'TestApp' }));

      const mockSchema = {
        parse: (data: unknown) => {
          if (typeof data === 'object' && data !== null && 'appName' in data) {
            return data;
          }
          throw new Error('Invalid config');
        },
      };

      const reader = new ConfigReader({
        filePatterns: ['config.json'],
        schema: mockSchema,
      });

      const result = await reader.read(testDir);
      expect(result.config).toHaveProperty('appName', 'TestApp');
    });

    it('should throw error on invalid config', async () => {
      const configPath = join(testDir, 'config.json');
      await writeFile(configPath, JSON.stringify({ wrongField: 'value' }));

      const mockSchema = {
        parse: (data: unknown) => {
          if (typeof data === 'object' && data !== null && 'appName' in data) {
            return data;
          }
          throw new Error('Invalid config: missing appName');
        },
      };

      const reader = new ConfigReader({
        filePatterns: ['config.json'],
        schema: mockSchema,
      });

      await expect(reader.read(testDir)).rejects.toThrow('Invalid config: missing appName');
    });
  });

  describe('Config inheritance', () => {
    it('should merge config with parent via extends', async () => {
      // Create parent config
      const parentPath = join(testDir, 'base.json');
      await writeFile(parentPath, JSON.stringify({ appName: 'BaseApp', version: '1.0.0' }));

      // Create child config that extends parent
      const childPath = join(testDir, 'config.json');
      await writeFile(
        childPath,
        JSON.stringify({
          extends: './base.json',
          appName: 'ChildApp', // Override
          newField: 'value', // Add new field
        }),
      );

      const reader = new ConfigReader({
        filePatterns: ['config.json'],
        extends: true,
      });

      const result = await reader.read(testDir);

      expect(result.config).toEqual({
        extends: './base.json',
        appName: 'ChildApp', // Overridden
        version: '1.0.0', // Inherited
        newField: 'value', // Added
      });
    });

    it('should handle nested extends', async () => {
      // Create grandparent
      const grandparentPath = join(testDir, 'base.json');
      await writeFile(grandparentPath, JSON.stringify({ level: 'grandparent', a: 1 }));

      // Create parent that extends grandparent
      const parentPath = join(testDir, 'parent.json');
      await writeFile(
        parentPath,
        JSON.stringify({
          extends: './base.json',
          level: 'parent',
          b: 2,
        }),
      );

      // Create child that extends parent
      const childPath = join(testDir, 'config.json');
      await writeFile(
        childPath,
        JSON.stringify({
          extends: './parent.json',
          level: 'child',
          c: 3,
        }),
      );

      const reader = new ConfigReader({
        filePatterns: ['config.json'],
        extends: true,
      });

      const result = await reader.read(testDir);

      expect((result.config as any).level).toBe('child');
      expect((result.config as any).a).toBe(1);
      expect((result.config as any).b).toBe(2);
      expect((result.config as any).c).toBe(3);
    });
  });
});
