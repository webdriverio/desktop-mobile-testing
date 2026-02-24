import type {
  TauriResult as BaseTauriResult,
  TauriServiceGlobalOptions as BaseTauriServiceGlobalOptions,
  TauriServiceOptions as BaseTauriServiceOptions,
} from '@wdio/native-types';

// Re-export the base result type as-is
export type TauriResult<T = unknown> = BaseTauriResult<T>;

/**
 * Extended Tauri service options with implementation-specific fields
 * Extends the base TauriServiceOptions from native-types with:
 * - autoInstallTauriDriver: Auto-install driver if not found
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
  /**
   * Driver provider to use for WebDriver communication.
   * - 'embedded': Use embedded WebDriver server via tauri-plugin-wdio-server (default)
   * - 'official': Use cargo-installed tauri-driver
   * - 'crabnebula': Use @crabnebula/tauri-driver from npm
   *
   * Defaults to 'embedded' on all platforms. The embedded provider requires
   * tauri-plugin-wdio-server to be installed and registered in your Tauri app.
   * If you are not using the embedded plugin, set this to 'official'.
   *
   * Port used by the embedded provider (in priority order):
   * 1. embeddedPort option
   * 2. TAURI_WEBDRIVER_PORT environment variable
   * 3. Default: 4445
   *
   * @default 'embedded'
   */
  driverProvider?: 'official' | 'crabnebula' | 'embedded';
  /**
   * Path to @crabnebula/tauri-driver executable
   * If not provided, will be auto-detected from node_modules
   */
  crabnebulaDriverPath?: string;
  /**
   * Auto-manage test-runner-backend process (macOS only)
   * Required for macOS testing with CrabNebula
   * @default true when driverProvider is 'crabnebula' and platform is darwin
   */
  crabnebulaManageBackend?: boolean;
  /**
   * Port for test-runner-backend (macOS only)
   * @default 3000
   */
  crabnebulaBackendPort?: number;
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
 * Tauri service capabilities - extends the base with additional options
 */
export interface TauriCapabilities extends WebdriverIO.Capabilities {
  // Allow 'tauri' or 'wry' in user config, but browserName will remain undefined
  // Flow: onPrepare validates browserName (if set)
  //    -> onWorkerStart removes browserName (tauri-driver doesn't need it)
  //    -> browserName remains undefined throughout - reporters handle this gracefully
  browserName?: 'tauri' | 'wry';
  'tauri:options'?: {
    application: string;
    args?: string[];
    webviewOptions?: {
      width?: number;
      height?: number;
    };
  };
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
