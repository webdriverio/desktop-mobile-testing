import type { Capabilities, Options } from '@wdio/types';
import type { ChainablePromiseArray, ChainablePromiseElement } from 'webdriverio';

/**
 * Tauri APIs object type - matches window.__TAURI__ structure
 */
export interface TauriAPIs {
  core: {
    invoke: (command: string, ...args: unknown[]) => Promise<unknown>;
  };
  app?: {
    getName: () => Promise<string>;
    getVersion: () => Promise<string>;
  };
  window?: unknown;
  event?: unknown;
  [key: string]: unknown;
}

/**
 * Tauri Service API interface for browser object
 */
export interface TauriServiceAPI {
  /**
   * Execute JavaScript code in the Tauri frontend context with access to Tauri APIs.
   *
   * @example
   * ```js
   * const result = await browser.tauri.execute(({ core }) => core.invoke('get_platform_info'));
   * ```
   *
   * @param script - Function to execute (receives Tauri APIs as first parameter) or string
   * @param args - Additional arguments to pass to the script
   */
  execute<ReturnValue, InnerArguments extends unknown[]>(
    script: string | ((tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue),
    ...args: InnerArguments
  ): Promise<ReturnValue | undefined>;

  /**
   * Check if a function is a Tauri mock function.
   *
   * @param fn - Function to check
   * @returns True if the function is a Tauri mock
   */
  isMockFunction: (fn: unknown) => boolean;

  /**
   * Mock a Tauri API command.
   *
   * @param apiName - Name of the API to mock
   * @param funcName - Name of the function to mock
   * @returns Promise that resolves to the mock
   */
  mock: (apiName: string, funcName: string) => Promise<unknown>;

  /**
   * Mock all functions from a Tauri API.
   *
   * @param apiName - Name of the API to mock
   * @returns Promise that resolves to the mocks
   */
  mockAll: (apiName: string) => Promise<unknown>;

  /**
   * Clear all Tauri API mocks.
   */
  clearAllMocks: () => Promise<void>;

  /**
   * Reset all Tauri API mocks.
   */
  resetAllMocks: () => Promise<void>;

  /**
   * Restore all Tauri API mocks.
   */
  restoreAllMocks: () => Promise<void>;
}

/**
 * The options for the Tauri Service.
 */
export interface TauriServiceOptions {
  /**
   * The path to the Tauri binary of the app for testing.
   */
  appBinaryPath?: string;
  /**
   * An array of string arguments to be passed through to the app on execution of the test run.
   */
  appArgs?: string[];
  /**
   * The port for tauri-driver to listen on.
   */
  tauriDriverPort?: number;
  /**
   * The path to the tauri-driver executable.
   */
  tauriDriverPath?: string;
  /**
   * Log level for tauri-driver.
   */
  logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Timeout for command execution.
   */
  commandTimeout?: number;
  /**
   * Timeout for app startup.
   */
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
}

/**
 * Tauri service result type
 */
export interface TauriResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Tauri service capabilities
 */
export interface TauriServiceCapabilities {
  browserName?: 'tauri';
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

type TauriServiceRequestedStandaloneCapabilities = Capabilities.RequestedStandaloneCapabilities &
  TauriServiceCapabilities;
type TauriServiceRequestedMultiremoteCapabilities = Capabilities.RequestedMultiremoteCapabilities &
  TauriServiceCapabilities;

export type TauriServiceCapabilitiesType =
  | TauriServiceRequestedStandaloneCapabilities[]
  | TauriServiceRequestedMultiremoteCapabilities
  | TauriServiceRequestedMultiremoteCapabilities[];

export type WdioTauriConfig = Options.Testrunner & {
  capabilities: TauriServiceCapabilitiesType | TauriServiceCapabilitiesType[];
};

type $ = (selector: unknown) => ChainablePromiseElement;
type $$ = (selector: unknown) => ChainablePromiseArray;

type SelectorsBase = {
  $: $;
  $$: $$;
};
type BaseWithExecute = {
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): T;
  executeAsync(script: string | ((...args: unknown[]) => void), ...args: unknown[]): unknown;
};
type ElementBase = SelectorsBase & {
  parent: ElementBase | BaseWithExecute;
};
type BrowserBase = SelectorsBase & {
  addCommand<T extends boolean>(
    queryName: string,
    commandFn: (this: T extends true ? ElementBase : BrowserBase, ...args: unknown[]) => void,
    isElementCommand?: T,
  ): unknown;
};

export interface BrowserExtension extends BrowserBase {
  /**
   * Access the WebdriverIO Tauri Service API.
   *
   * - {@link TauriServiceAPI.clearAllMocks `browser.tauri.clearAllMocks`} - Clear the Tauri API mock functions
   * - {@link TauriServiceAPI.execute `browser.tauri.execute`} - Execute code in the Tauri frontend context
   * - {@link TauriServiceAPI.mock `browser.tauri.mock`} - Mock a function from the Tauri API
   * - {@link TauriServiceAPI.mockAll `browser.tauri.mockAll`} - Mock an entire API object of the Tauri API
   * - {@link TauriServiceAPI.resetAllMocks `browser.tauri.resetAllMocks`} - Reset the Tauri API mock functions
   * - {@link TauriServiceAPI.restoreAllMocks `browser.tauri.restoreAllMocks`} - Restore the original Tauri API functionality
   */
  tauri: TauriServiceAPI;
}

type TauriServiceCustomCapability = {
  /**
   * custom capabilities to configure the Tauri service
   */
  'wdio:tauriServiceOptions'?: TauriServiceOptions;
};

declare global {
  // biome-ignore lint/style/noNamespace: This is a legitimate use of namespace for global augmentation
  namespace WebdriverIO {
    interface Browser extends BrowserExtension {}
    interface Element extends ElementBase {}
    interface MultiRemoteBrowser extends BrowserExtension {}
    interface Capabilities extends TauriServiceCustomCapability {}
    interface ServiceOption extends TauriServiceGlobalOptions {}
  }

  var browser: WebdriverIO.Browser;
}

/**
 * Version constant to ensure the module has runtime code
 * This is needed for bundlers that require at least one runtime export
 */
export const __tauriTypesVersion = '0.1.0';
