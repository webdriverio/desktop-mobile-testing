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
}

/**
 * Tauri service capabilities
 */
export interface TauriCapabilities extends WebdriverIO.Capabilities {
  browserName: 'tauri';
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
