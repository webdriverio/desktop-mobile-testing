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
   * Automatically install tauri-driver if not found
   * Requires Rust toolchain (cargo) to be installed
   * @default false
   */
  autoInstallTauriDriver?: boolean;
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
   * Automatically install tauri-driver if not found
   * @default false
   */
  autoInstallTauriDriver?: boolean;
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
