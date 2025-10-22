import path from 'node:path';

/**
 * Supported platform types
 */
export type SupportedPlatform = 'darwin' | 'win32' | 'linux';

/**
 * Platform display names
 */
export type PlatformDisplayName = 'macOS' | 'Windows' | 'Linux';

/**
 * Binary extension for each platform
 */
export type BinaryExtension = '.exe' | '.app' | '';

/**
 * Framework-agnostic platform detection and utilities
 * Provides cross-platform helpers for path handling, platform detection, etc.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class with static methods is intentional for namespace-like organization
export class PlatformUtils {
  /**
   * Get current platform
   *
   * @returns Platform identifier (darwin, win32, linux)
   * @example
   * ```typescript
   * const platform = PlatformUtils.getPlatform();
   * // Returns 'darwin' on macOS, 'win32' on Windows, 'linux' on Linux
   * ```
   */
  static getPlatform(): SupportedPlatform {
    return process.platform as SupportedPlatform;
  }

  /**
   * Get display name for platform
   *
   * @returns Human-readable platform name
   * @example
   * ```typescript
   * const name = PlatformUtils.getPlatformDisplayName();
   * // Returns 'macOS' on macOS, 'Windows' on Windows, 'Linux' on Linux
   * ```
   */
  static getPlatformDisplayName(): PlatformDisplayName {
    const map: Record<SupportedPlatform, PlatformDisplayName> = {
      darwin: 'macOS',
      win32: 'Windows',
      linux: 'Linux',
    };
    return map[PlatformUtils.getPlatform()];
  }

  /**
   * Get binary extension for current platform
   *
   * @returns Binary extension (.exe, .app, or empty string)
   * @example
   * ```typescript
   * const ext = PlatformUtils.getBinaryExtension();
   * // Returns '.exe' on Windows, '.app' on macOS, '' on Linux
   * ```
   */
  static getBinaryExtension(): BinaryExtension {
    const platform = PlatformUtils.getPlatform();
    if (platform === 'win32') return '.exe';
    if (platform === 'darwin') return '.app';
    return '';
  }

  /**
   * Get platform architecture
   *
   * @returns Architecture string (x64, arm64, etc.)
   * @example
   * ```typescript
   * const arch = PlatformUtils.getArchitecture();
   * // Returns 'x64', 'arm64', etc.
   * ```
   */
  static getArchitecture(): string {
    return process.arch;
  }

  /**
   * Normalize path for current platform
   * Converts path separators to platform-specific format
   *
   * @param inputPath - Path to normalize
   * @returns Normalized path
   * @example
   * ```typescript
   * const normalized = PlatformUtils.normalizePath('some/path\\to/file');
   * // Returns path with platform-appropriate separators
   * ```
   */
  static normalizePath(inputPath: string): string {
    return path.normalize(inputPath);
  }

  /**
   * Check if running in CI environment
   * Checks common CI environment variables
   *
   * @returns True if running in CI
   * @example
   * ```typescript
   * if (PlatformUtils.isCI()) {
   *   console.log('Running in CI environment');
   * }
   * ```
   */
  static isCI(): boolean {
    return Boolean(
      process.env.CI ||
        process.env.CONTINUOUS_INTEGRATION ||
        process.env.BUILD_NUMBER || // Jenkins
        process.env.GITHUB_ACTIONS ||
        process.env.GITLAB_CI ||
        process.env.CIRCLECI ||
        process.env.TRAVIS,
    );
  }

  /**
   * Get Node.js version
   *
   * @returns Node.js version string
   * @example
   * ```typescript
   * const version = PlatformUtils.getNodeVersion();
   * // Returns 'v18.0.0', 'v20.0.0', etc.
   * ```
   */
  static getNodeVersion(): string {
    return process.version;
  }

  /**
   * Sanitize app name for use in file paths
   * Converts spaces to hyphens on Linux (Linux doesn't support spaces in binary names)
   *
   * @param appName - Application name to sanitize
   * @param platform - Platform to sanitize for (defaults to current platform)
   * @returns Sanitized app name
   * @example
   * ```typescript
   * const sanitized = PlatformUtils.sanitizeAppNameForPath('My App Name');
   * // Returns 'my-app-name' on Linux, 'My App Name' on other platforms
   * ```
   */
  static sanitizeAppNameForPath(appName: string, platform?: SupportedPlatform): string {
    const targetPlatform = platform || PlatformUtils.getPlatform();
    return targetPlatform === 'linux' ? appName.toLowerCase().replace(/ /g, '-') : appName;
  }

  /**
   * Get path separator for current platform
   *
   * @returns Path separator ('/' or '\')
   * @example
   * ```typescript
   * const sep = PlatformUtils.getPathSeparator();
   * // Returns '\\' on Windows, '/' on Unix-like systems
   * ```
   */
  static getPathSeparator(): string {
    return path.sep;
  }

  /**
   * Get environment variable value
   * Provides safe access to environment variables
   *
   * @param name - Environment variable name
   * @param defaultValue - Default value if variable is not set
   * @returns Environment variable value or default
   * @example
   * ```typescript
   * const home = PlatformUtils.getEnvVar('HOME', '/home/user');
   * ```
   */
  static getEnvVar(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }

  /**
   * Check if a platform is supported
   *
   * @param platform - Platform to check
   * @returns True if platform is supported
   */
  static isSupportedPlatform(platform: string): platform is SupportedPlatform {
    return platform === 'darwin' || platform === 'win32' || platform === 'linux';
  }

  /**
   * Get home directory for current user
   *
   * @returns Home directory path
   * @example
   * ```typescript
   * const home = PlatformUtils.getHomeDirectory();
   * // Returns '/Users/username' on macOS, 'C:\\Users\\username' on Windows, etc.
   * ```
   */
  static getHomeDirectory(): string {
    return process.env.HOME || process.env.USERPROFILE || '/';
  }

  /**
   * Get temporary directory
   *
   * @returns Temp directory path
   * @example
   * ```typescript
   * const tmpDir = PlatformUtils.getTempDirectory();
   * ```
   */
  static getTempDirectory(): string {
    return process.env.TMPDIR || process.env.TEMP || process.env.TMP || '/tmp';
  }
}
