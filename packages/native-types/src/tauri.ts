import type { Mock } from '@wdio/native-spy';
import type { Capabilities, Options } from '@wdio/types';
import type { AbstractFn, BrowserBase, MockContext, MockOverride, MockResult } from './shared.js';

// ============================================================================
// Tauri-Specific Types
// ============================================================================

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
 * Tauri mock context
 */
interface TauriMockContext extends MockContext {
  results: MockResult[];
}

/**
 * Tauri mock instance interface
 */
export interface TauriMockInstance extends Omit<Mock, MockOverride> {
  mockImplementation(fn: AbstractFn): Promise<TauriMock>;
  mockImplementationOnce(fn: AbstractFn): Promise<TauriMock>;
  mockReturnValue(obj: unknown): Promise<TauriMock>;
  mockReturnValueOnce(obj: unknown): Promise<TauriMock>;
  mockResolvedValue(obj: unknown): Promise<TauriMock>;
  mockResolvedValueOnce(obj: unknown): Promise<TauriMock>;
  mockRejectedValue(obj: unknown): Promise<TauriMock>;
  mockRejectedValueOnce(obj: unknown): Promise<TauriMock>;
  mockClear(): Promise<TauriMock>;
  mockReset(): Promise<TauriMock>;
  mockRestore(): Promise<TauriMock>;
  mockReturnThis(): Promise<unknown>;
  withImplementation<ReturnValue, InnerArguments extends unknown[]>(
    implFn: AbstractFn,
    callbackFn: (tauri: TauriAPIs, ...innerArgs: InnerArguments) => ReturnValue,
  ): Promise<unknown>;
  mockName(name: string): TauriMock;
  getMockName(): string;
  getMockImplementation(): AbstractFn;
  update(): Promise<TauriMock>;
  __isTauriMock: boolean;
  mock: TauriMockContext;
  results: MockResult[];
  invocationCallOrder: number[];
  lastCall?: unknown;
}

/**
 * Tauri mock function type
 */
export interface TauriMock<TArgs extends unknown[] = unknown[], TReturns = unknown> extends TauriMockInstance {
  new (...args: TArgs): TReturns;
  (...args: TArgs): TReturns;
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
   * Check if a command is a Tauri mock function.
   *
   * @param command - Command name to check
   * @returns True if the command is mocked
   */
  isMockFunction: (command: string) => Promise<boolean>;

  /**
   * Mock a Tauri backend command.
   *
   * @param command - Name of the Tauri command to mock
   * @returns Promise that resolves to the mock
   *
   * @example
   * ```js
   * const mock = await browser.tauri.mock('read_clipboard');
   * await mock.mockReturnValue('mocked clipboard content');
   * ```
   */
  mock: (command: string) => Promise<TauriMock>;

  /**
   * Mock all Tauri commands.
   *
   * @returns Promise that resolves when all mocks are cleared
   */
  mockAll: () => Promise<void>;

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

  /**
   * Trigger a deeplink to the Tauri application for testing protocol handlers.
   *
   * @param url - The deeplink URL to trigger (e.g., 'myapp://open?path=/test')
   * @returns Promise that resolves when the deeplink has been triggered
   *
   * @example
   * ```js
   * await browser.tauri.triggerDeeplink('myapp://open?file=test.txt');
   * ```
   */
  triggerDeeplink: (url: string) => Promise<void>;
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

type TauriServiceCustomCapability = {
  /**
   * custom capabilities to configure the Tauri service
   */
  'wdio:tauriServiceOptions'?: TauriServiceOptions;
};

/**
 * Browser extension for Tauri service
 */
export interface TauriBrowserExtension extends BrowserBase {
  /**
   * Access the WebdriverIO Tauri Service API.
   *
   * - {@link TauriServiceAPI.clearAllMocks `browser.tauri.clearAllMocks`} - Clear the Tauri API mock functions
   * - {@link TauriServiceAPI.execute `browser.tauri.execute`} - Execute code in the Tauri frontend context
   * - {@link TauriServiceAPI.mock `browser.tauri.mock`} - Mock a function from the Tauri API
   * - {@link TauriServiceAPI.mockAll `browser.tauri.mockAll`} - Mock an entire API object of the Tauri API
   * - {@link TauriServiceAPI.resetAllMocks `browser.tauri.resetAllMocks`} - Reset the Tauri API mock functions
   * - {@link TauriServiceAPI.restoreAllMocks `browser.tauri.restoreAllMocks`} - Restore the original Tauri API functionality
   * - {@link TauriServiceAPI.triggerDeeplink `browser.tauri.triggerDeeplink`} - Trigger a deeplink for testing protocol handlers
   */
  tauri: TauriServiceAPI;
}

// Re-export the custom capability for external use
export type { TauriServiceCustomCapability };
