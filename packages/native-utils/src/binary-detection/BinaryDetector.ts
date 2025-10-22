import fs from 'node:fs/promises';
import type {
  BinaryDetectionOptions,
  BinaryDetectionResult,
  PathGenerationResult,
  PathValidationAttempt,
  PathValidationError,
  PathValidationResult,
} from './types.js';

/**
 * Abstract base class for framework-specific binary detection
 *
 * Uses Template Method pattern:
 * - detectBinaryPath() is the template method (concrete, calls abstract methods)
 * - generatePossiblePaths() is abstract (framework-specific)
 * - validateBinaryPaths() is concrete (generic validation logic)
 *
 * @example
 * ```typescript
 * class ElectronBinaryDetector extends BinaryDetector {
 *   protected async generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult> {
 *     // Electron-specific logic: check Forge, Builder, unpackaged
 *     return {
 *       success: true,
 *       paths: ['/path/to/electron/app'],
 *       errors: []
 *     };
 *   }
 * }
 * ```
 */
export abstract class BinaryDetector {
  /**
   * Main entry point - Template Method pattern
   * This method orchestrates the two-phase detection process:
   * 1. Generate possible paths (framework-specific)
   * 2. Validate paths (generic)
   *
   * @param options - Detection options
   * @returns Complete detection result with diagnostic information
   */
  async detectBinaryPath(options: BinaryDetectionOptions): Promise<BinaryDetectionResult> {
    // Phase 1: Generate possible paths (framework-specific)
    const pathGeneration = await this.generatePossiblePaths(options);

    // Phase 2: Validate paths (generic)
    let pathValidation: PathValidationResult;

    if (!pathGeneration.success || pathGeneration.paths.length === 0) {
      pathValidation = {
        success: false,
        validPath: undefined,
        attempts: [],
      };
    } else {
      pathValidation = await this.validateBinaryPaths(pathGeneration.paths);
    }

    return {
      success: pathGeneration.success && pathValidation.success,
      binaryPath: pathValidation.validPath,
      pathGeneration,
      pathValidation,
    };
  }

  /**
   * Abstract method: Generate possible binary paths
   * Framework-specific implementations must provide this logic
   *
   * @param options - Detection options
   * @returns Path generation result with paths and any errors
   */
  protected abstract generatePossiblePaths(options: BinaryDetectionOptions): Promise<PathGenerationResult>;

  /**
   * Concrete method: Validate generated paths
   * Generic implementation that works across frameworks
   *
   * Checks each path in order and returns the first valid one
   * Valid = exists, is a file (not directory), and is executable
   *
   * @param paths - Paths to validate
   * @returns Validation result with first valid path
   */
  protected async validateBinaryPaths(paths: string[]): Promise<PathValidationResult> {
    const attempts: PathValidationAttempt[] = [];

    for (const currentPath of paths) {
      try {
        // Check if path exists and is executable
        await fs.access(currentPath, fs.constants.F_OK | fs.constants.X_OK);

        // Check if it's a file (not a directory)
        const stats = await fs.stat(currentPath);
        if (stats.isDirectory()) {
          attempts.push({
            path: currentPath,
            error: {
              type: 'IS_DIRECTORY',
              message: 'Path is a directory, not a file',
            },
          });
          continue;
        }

        // Path exists, is a file, and is executable - success!
        return {
          success: true,
          validPath: currentPath,
          attempts,
        };
      } catch (error) {
        // Path validation failed - categorize the error
        attempts.push({
          path: currentPath,
          error: this.categorizeValidationError(error),
        });
      }
    }

    // No valid path found
    return {
      success: false,
      validPath: undefined,
      attempts,
    };
  }

  /**
   * Categorize validation errors into specific types
   * Helps provide better error messages to users
   *
   * @param error - Error from fs operations
   * @returns Categorized validation error
   */
  private categorizeValidationError(error: unknown): PathValidationError {
    if (!(error instanceof Error)) {
      return {
        type: 'FILE_NOT_FOUND',
        message: 'Unknown error occurred',
      };
    }

    const nodeError = error as NodeJS.ErrnoException;

    switch (nodeError.code) {
      case 'ENOENT':
        return {
          type: 'FILE_NOT_FOUND',
          message: 'File not found',
        };
      case 'EACCES':
        return {
          type: 'PERMISSION_DENIED',
          message: 'Permission denied',
        };
      case 'EISDIR':
        return {
          type: 'IS_DIRECTORY',
          message: 'Path is a directory',
        };
      default:
        if (nodeError.message.includes('not executable')) {
          return {
            type: 'NOT_EXECUTABLE',
            message: 'File is not executable',
          };
        }
        return {
          type: 'FILE_NOT_FOUND',
          message: nodeError.message || 'File validation failed',
        };
    }
  }

  /**
   * Optional hook: Custom validation logic
   * Subclasses can override this to add framework-specific validation
   *
   * @param path - Path to validate
   * @returns True if path is valid according to framework-specific rules
   */
  protected async customValidation(_path: string): Promise<boolean> {
    // Default implementation does nothing
    // Subclasses can override to add framework-specific checks
    return true;
  }
}
