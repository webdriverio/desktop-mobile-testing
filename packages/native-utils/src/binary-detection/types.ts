/**
 * Type definitions for binary detection framework
 */

/**
 * Options for binary detection
 */
export interface BinaryDetectionOptions {
  /**
   * Project root directory to search in
   */
  projectRoot: string;

  /**
   * Optional framework version (e.g., Electron version, Flutter version)
   * Can be used to determine appropriate binary paths
   */
  frameworkVersion?: string;

  /**
   * Additional options for framework-specific detection
   */
  [key: string]: unknown;
}

/**
 * Types of path generation errors
 */
export type PathGenerationErrorType =
  | 'UNSUPPORTED_PLATFORM'
  | 'NO_BUILD_TOOL'
  | 'CONFIG_INVALID'
  | 'CONFIG_MISSING'
  | 'CONFIG_WARNING';

/**
 * Path generation error details
 */
export interface PathGenerationError {
  type: PathGenerationErrorType;
  message: string;
  buildTool?: string;
  details?: string;
}

/**
 * Result of path generation phase
 */
export interface PathGenerationResult {
  success: boolean;
  paths: string[];
  errors: PathGenerationError[];
}

/**
 * Types of path validation errors
 */
export type PathValidationErrorType = 'FILE_NOT_FOUND' | 'NOT_EXECUTABLE' | 'PERMISSION_DENIED' | 'IS_DIRECTORY';

/**
 * Path validation error details
 */
export interface PathValidationError {
  type: PathValidationErrorType;
  message: string;
}

/**
 * Attempt to validate a specific path
 */
export interface PathValidationAttempt {
  path: string;
  error?: PathValidationError;
}

/**
 * Result of path validation phase
 */
export interface PathValidationResult {
  success: boolean;
  validPath?: string;
  attempts: PathValidationAttempt[];
}

/**
 * Complete result of binary detection
 */
export interface BinaryDetectionResult {
  success: boolean;
  binaryPath?: string;
  pathGeneration: PathGenerationResult;
  pathValidation: PathValidationResult;
}
