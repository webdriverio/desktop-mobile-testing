import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BinaryDetector } from '../../../src/binary-detection/BinaryDetector.js';
import type { BinaryDetectionOptions, PathGenerationResult } from '../../../src/binary-detection/types.js';

/**
 * Test implementation of BinaryDetector
 * Allows us to test the abstract base class
 */
class TestBinaryDetector extends BinaryDetector {
  constructor(private mockPaths: string[]) {
    super();
  }

  protected async generatePossiblePaths(_options: BinaryDetectionOptions): Promise<PathGenerationResult> {
    return {
      success: true,
      paths: this.mockPaths,
      errors: [],
    };
  }
}

describe('BinaryDetector', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `binary-detector-test-${Date.now()}`);
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

  describe('detectBinaryPath', () => {
    it('should return first valid path', async () => {
      // Create a valid binary file
      const validPath = join(testDir, 'valid-app');
      await writeFile(validPath, '#!/bin/sh\\necho "test"');
      await chmod(validPath, 0o755); // Make executable

      const detector = new TestBinaryDetector(['/invalid/path', validPath, '/another/invalid']);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(true);
      expect(result.binaryPath).toBe(validPath);
      expect(result.pathGeneration.success).toBe(true);
      expect(result.pathValidation.success).toBe(true);
    });

    it('should fail when no valid paths exist', async () => {
      const detector = new TestBinaryDetector(['/invalid/path1', '/invalid/path2']);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(false);
      expect(result.binaryPath).toBeUndefined();
      expect(result.pathValidation.success).toBe(false);
      expect(result.pathValidation.attempts).toHaveLength(2);
    });

    it('should record all validation attempts', async () => {
      const detector = new TestBinaryDetector(['/invalid1', '/invalid2', '/invalid3']);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.pathValidation.attempts).toHaveLength(3);
      expect(result.pathValidation.attempts[0].path).toBe('/invalid1');
      expect(result.pathValidation.attempts[1].path).toBe('/invalid2');
      expect(result.pathValidation.attempts[2].path).toBe('/invalid3');
    });

    it('should handle empty paths array', async () => {
      const detector = new TestBinaryDetector([]);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(false);
      expect(result.binaryPath).toBeUndefined();
      expect(result.pathValidation.attempts).toHaveLength(0);
    });

    it('should pass options to generatePossiblePaths', async () => {
      let capturedOptions: BinaryDetectionOptions | undefined;

      class CapturingDetector extends BinaryDetector {
        protected async generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult> {
          capturedOptions = options;
          return { success: true, paths: [], errors: [] };
        }
      }

      const detector = new CapturingDetector();
      const options = { projectRoot: '/test/root', frameworkVersion: '1.0.0' };
      await detector.detectBinaryPath(options);

      expect(capturedOptions).toEqual(options);
    });
  });

  describe('path validation', () => {
    it('should reject directories', async () => {
      // Create a directory instead of a file
      const dirPath = join(testDir, 'some-directory');
      await mkdir(dirPath, { recursive: true });

      const detector = new TestBinaryDetector([dirPath]);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(false);
      expect(result.pathValidation.attempts[0].error?.type).toBe('IS_DIRECTORY');
    });

    it('should reject non-executable files', async () => {
      // Create a file without execute permissions
      const filePath = join(testDir, 'non-executable');
      await writeFile(filePath, 'test content');
      // Don't set executable bit

      const detector = new TestBinaryDetector([filePath]);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(false);
      // File exists but is not executable
      expect(result.pathValidation.attempts[0].error).toBeDefined();
    });

    it('should categorize FILE_NOT_FOUND error', async () => {
      const detector = new TestBinaryDetector(['/this/path/does/not/exist']);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.pathValidation.attempts[0].error?.type).toBe('FILE_NOT_FOUND');
    });

    it('should accept executable files', async () => {
      const exePath = join(testDir, 'executable');
      await writeFile(exePath, '#!/bin/sh\\necho "test"');
      await chmod(exePath, 0o755);

      const detector = new TestBinaryDetector([exePath]);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(true);
      expect(result.binaryPath).toBe(exePath);
    });
  });

  describe('error handling', () => {
    it('should handle path generation failure', async () => {
      class FailingDetector extends BinaryDetector {
        protected async generatePossiblePaths(): Promise<PathGenerationResult> {
          return {
            success: false,
            paths: [],
            errors: [
              {
                type: 'NO_BUILD_TOOL',
                message: 'No build tool found',
              },
            ],
          };
        }
      }

      const detector = new FailingDetector();
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(false);
      expect(result.pathGeneration.success).toBe(false);
      expect(result.pathGeneration.errors).toHaveLength(1);
      expect(result.pathGeneration.errors[0].type).toBe('NO_BUILD_TOOL');
    });

    it('should preserve generation warnings', async () => {
      class WarningDetector extends BinaryDetector {
        protected async generatePossiblePaths(): Promise<PathGenerationResult> {
          const validPath = join(testDir, 'app');
          await writeFile(validPath, 'test');
          await chmod(validPath, 0o755);

          return {
            success: true,
            paths: [validPath],
            errors: [
              {
                type: 'CONFIG_WARNING',
                message: 'Using default config',
              },
            ],
          };
        }
      }

      const detector = new WarningDetector();
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(true);
      expect(result.pathGeneration.errors).toHaveLength(1);
      expect(result.pathGeneration.errors[0].type).toBe('CONFIG_WARNING');
    });
  });

  describe('integration scenarios', () => {
    it('should find first valid path among mixed valid/invalid', async () => {
      const invalid1 = '/does/not/exist';
      const invalid2 = join(testDir, 'also-invalid');
      const valid = join(testDir, 'valid-binary');
      const invalid3 = '/another/invalid';

      await writeFile(valid, '#!/bin/sh');
      await chmod(valid, 0o755);

      const detector = new TestBinaryDetector([invalid1, invalid2, valid, invalid3]);
      const result = await detector.detectBinaryPath({ projectRoot: testDir });

      expect(result.success).toBe(true);
      expect(result.binaryPath).toBe(valid);
      // Should have attempted invalid1 and invalid2, then found valid
      expect(result.pathValidation.attempts.length).toBeLessThanOrEqual(3);
    });

    it('should handle framework version in options', async () => {
      const detector = new TestBinaryDetector([]);
      const result = await detector.detectBinaryPath({
        projectRoot: testDir,
        frameworkVersion: '3.0.0',
      });

      // Should not throw, even if no paths found
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
    });
  });
});
