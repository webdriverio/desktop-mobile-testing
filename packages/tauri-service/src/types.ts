/**
 * Tauri service result type
 * Matches the pattern used by Electron service execute function
 */
export interface TauriResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Tauri service options
 */
export interface TauriServiceOptions {
  appBinaryPath?: string;
  appArgs?: string[];
  tauriDriverPort?: number;
  tauriDriverPath?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  commandTimeout?: number;
  startTimeout?: number;
  /**
   * Enable/disable capturing Rust backend logs from stdout
   * @default false
   */
  captureBackendLogs?: boolean;
  /**
   * Enable/disable capturing frontend console logs from webview
   * @default false
   */
  captureFrontendLogs?: boolean;
  /**
   * Minimum log level for backend logs (only logs at this level and above will be captured)
   * @default 'info'
   */
  backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Minimum log level for frontend logs (only logs at this level and above will be captured)
   * @default 'info'
   */
  frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Log directory for standalone mode
   * Full path where log files should be written
   * If not specified, uses logs/standalone-{appDirName}/ in current working directory
   * @default undefined
   */
  logDir?: string;
  /**
   * Automatically install tauri-driver if not found
   * Requires Rust toolchain (cargo) to be installed
   * @default false
   */
  autoInstallTauriDriver?: boolean;
}

/**
 * Tauri service capabilities
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
 * Tauri service global options
 */
export interface TauriServiceGlobalOptions {
  rootDir?: string;
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  commandTimeout?: number;
  startTimeout?: number;
  tauriDriverPort?: number;
  nativeDriverPath?: string;
  /**
   * Enable/disable capturing Rust backend logs from stdout
   * @default false
   */
  captureBackendLogs?: boolean;
  /**
   * Enable/disable capturing frontend console logs from webview
   * @default false
   */
  captureFrontendLogs?: boolean;
  /**
   * Minimum log level for backend logs (only logs at this level and above will be captured)
   * @default 'info'
   */
  backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Minimum log level for frontend logs (only logs at this level and above will be captured)
   * @default 'info'
   */
  frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Automatically install tauri-driver if not found
   * @default false
   */
  autoInstallTauriDriver?: boolean;
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
