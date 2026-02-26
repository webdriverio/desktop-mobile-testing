import type {
  TauriServiceGlobalOptions as BaseTauriServiceGlobalOptions,
  TauriServiceOptions as BaseTauriServiceOptions,
} from '@wdio/native-types';

// Re-export types from native-types for convenience
export type { TauriResult } from '@wdio/native-types';

/**
 * Extended Tauri service options with implementation-specific fields
 * Extends the base TauriServiceOptions from native-types with:
 * - env: Environment variables for the driver process
 * - autoInstallTauriDriver: Auto-install driver if not found
 * - autoDownloadEdgeDriver: Auto-download Edge driver on Windows
 * - logDir: Custom log directory for standalone mode
 */
export interface TauriServiceOptions extends BaseTauriServiceOptions {
  /**
   * Environment variables to pass to the spawned tauri-driver process
   * These are merged with process.env when spawning the driver
   */
  env?: Record<string, string>;
  /**
   * Automatically install tauri-driver if not found
   * Requires Rust toolchain (cargo) to be installed
   * @default false
   */
  autoInstallTauriDriver?: boolean;
  /**
   * Automatically download and configure matching msedgedriver on Windows
   * Detects Edge version and ensures WebDriver matches to prevent version mismatch errors
   * Only applies on Windows platform, ignored on Linux/macOS
   * @default true
   */
  autoDownloadEdgeDriver?: boolean;
  /**
   * Log directory for standalone mode
   * Full path where log files should be written
   * If not specified, uses logs/standalone-{appDirName}/ in current working directory
   * @default undefined
   */
  logDir?: string;
}

/**
 * Extended Tauri service global options with implementation-specific fields
 */
export interface TauriServiceGlobalOptions extends BaseTauriServiceGlobalOptions {
  /**
   * Environment variables to pass to the spawned tauri-driver process
   */
  env?: Record<string, string>;
  /**
   * Automatically install tauri-driver if not found
   * @default false
   */
  autoInstallTauriDriver?: boolean;
  /**
   * Automatically download and configure matching msedgedriver on Windows
   * @default true
   */
  autoDownloadEdgeDriver?: boolean;
}

/**
 * Extended Tauri capabilities with implementation-specific options
 * Re-exports the base TauriCapabilities but uses the extended TauriServiceOptions
 */
export interface TauriCapabilities
  extends Omit<import('@wdio/native-types').TauriCapabilities, 'wdio:tauriServiceOptions'> {
  'wdio:tauriServiceOptions'?: TauriServiceOptions;
}

/**
 * Tauri command execution context
 */
export interface TauriCommandContext {
  command: string;
  args: unknown[];
  timeout?: number;
}

/**
 * Tauri driver process information
 */
export interface TauriDriverProcess {
  pid: number;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
}

/**
 * Tauri app information
 */
export interface TauriAppInfo {
  name: string;
  version: string;
  binaryPath: string;
  configPath: string;
  targetDir: string;
}
