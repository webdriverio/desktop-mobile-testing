/**
 * Global options for native services
 * Framework-specific services can extend this interface
 */
export interface NativeServiceGlobalOptions {
  /**
   * Root directory of the project
   */
  rootDir?: string;

  /**
   * Additional framework-specific options
   */
  [key: string]: unknown;
}

/**
 * Base capabilities for native services
 * Framework-specific services can extend this
 */
export interface NativeServiceCapabilities extends Record<string, unknown> {
  // Can be extended by framework-specific implementations
}

/**
 * Result of service initialization
 */
export interface ServiceInitResult {
  success: boolean;
  error?: string;
}

/**
 * Configuration for a native session
 */
export interface NativeSessionConfig {
  /**
   * Port for the debugging/CDP protocol
   */
  debugPort: number;

  /**
   * Chrome options for the session
   */
  chromeOptions: Record<string, unknown>;

  /**
   * Additional session-specific options
   */
  [key: string]: unknown;
}
