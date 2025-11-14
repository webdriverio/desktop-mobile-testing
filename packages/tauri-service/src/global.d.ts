declare module '@wdio/spec-reporter';

declare module '@wdio/native-utils' {
  export function createLogger(
    name: string,
    scope?: string,
  ): {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  export function waitUntilWindowAvailable(browser: WebdriverIO.Browser): Promise<void>;
}

declare module '@wdio/native-types' {
  export interface TauriAPIs {
    core: {
      invoke: (command: string, ...args: unknown[]) => Promise<unknown>;
    };
    [key: string]: unknown;
  }

  export interface TauriServiceAPI {
    execute<ReturnValue, InnerArguments extends unknown[]>(
      script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
      ...args: InnerArguments
    ): Promise<ReturnValue | undefined>;
    isMockFunction: (fn: unknown) => boolean;
    mock: (apiName: string, funcName: string) => Promise<unknown>;
    mockAll: (apiName: string) => Promise<unknown>;
    clearAllMocks: () => Promise<void>;
    resetAllMocks: () => Promise<void>;
    restoreAllMocks: () => Promise<void>;
  }

  export interface TauriResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
  }

  export interface TauriServiceOptions {
    appBinaryPath?: string;
    appArgs?: string[];
    tauriDriverPort?: number;
    tauriDriverPath?: string;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    commandTimeout?: number;
    startTimeout?: number;
    captureBackendLogs?: boolean;
    captureFrontendLogs?: boolean;
    backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  }

  export interface TauriServiceGlobalOptions {
    rootDir?: string;
    logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    commandTimeout?: number;
    startTimeout?: number;
    tauriDriverPort?: number;
    nativeDriverPath?: string;
    captureBackendLogs?: boolean;
    captureFrontendLogs?: boolean;
    backendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    frontendLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  }

  export interface TauriServiceCapabilities extends WebdriverIO.Capabilities {
    browserName?: string;
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

  export type TauriServiceCapabilitiesType = TauriServiceCapabilities[];
}
