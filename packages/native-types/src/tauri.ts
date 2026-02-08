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
  ): Promise<ReturnValue>;

  /**
   * Check if a value is a Tauri mock function.
   * This is a TypeScript type guard that narrows the type when true.
   *
   * @param fn - Value to check
   * @returns True if the value is a TauriMockInstance
   * @example
   * ```js
   * const mock = await browser.tauri.mock('clipboard_read');
   * if (browser.tauri.isMockFunction(mock)) {
   *   // TypeScript knows mock is TauriMockInstance here
   *   expect(mock.mock.calls).toHaveLength(1);
   * }
   * ```
   */
  isMockFunction: (fn: unknown) => fn is TauriMockInstance;

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
   * Clear all Tauri API mocks.
   *
   * @param commandPrefix - Optional command name prefix to filter which mocks to clear.
   *                        If provided, only mocks with command names starting with this prefix will be cleared.
   *                        If omitted, all mocks will be cleared.
   * @example
   * ```js
   * // Clear all mocks
   * await browser.tauri.clearAllMocks();
   *
   * // Clear only clipboard-related mocks
   * await browser.tauri.clearAllMocks('clipboard');
   * ```
   */
  clearAllMocks: (commandPrefix?: string) => Promise<void>;

  /**
   * Reset all Tauri API mocks.
   *
   * @param commandPrefix - Optional command name prefix to filter which mocks to reset.
   *                        If provided, only mocks with command names starting with this prefix will be reset.
   *                        If omitted, all mocks will be reset.
   */
  resetAllMocks: (commandPrefix?: string) => Promise<void>;

  /**
   * Restore all Tauri API mocks.
   *
   * @param commandPrefix - Optional command name prefix to filter which mocks to restore.
   *                        If provided, only mocks with command names starting with this prefix will be restored.
   *                        If omitted, all mocks will be restored.
   */
  restoreAllMocks: (commandPrefix?: string) => Promise<void>;

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
  /**
   * Driver provider to use for WebDriver communication
   * - 'official': Use cargo-installed tauri-driver (default)
   * - 'crabnebula': Use @crabnebula/tauri-driver from npm (enables macOS support)
   * @default 'official'
   */
  driverProvider?: 'official' | 'crabnebula';
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
   * If true, all mock call history will be cleared before each test.
   * Equivalent to calling `browser.tauri.clearAllMocks()` before each test.
   * @default false
   */
  clearMocks?: boolean;
  /**
   * Optional command name prefix to filter which mocks to clear before each test.
   * Only used when clearMocks is true. If provided, only mocks with command names
   * starting with this prefix will be cleared.
   * @default undefined
   */
  clearMocksPrefix?: string;
  /**
   * If true, all mocks will be reset (implementation + history) before each test.
   * Equivalent to calling `browser.tauri.resetAllMocks()` before each test.
   * @default false
   */
  resetMocks?: boolean;
  /**
   * Optional command name prefix to filter which mocks to reset before each test.
   * Only used when resetMocks is true. If provided, only mocks with command names
   * starting with this prefix will be reset.
   * @default undefined
   */
  resetMocksPrefix?: string;
  /**
   * If true, all mocks will be restored to their original implementations before each test.
   * Equivalent to calling `browser.tauri.restoreAllMocks()` before each test.
   * @default false
   */
  restoreMocks?: boolean;
  /**
   * Optional command name prefix to filter which mocks to restore before each test.
   * Only used when restoreMocks is true. If provided, only mocks with command names
   * starting with this prefix will be restored.
   * @default undefined
   */
  restoreMocksPrefix?: string;
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
   * Driver provider to use for WebDriver communication
   * - 'official': Use cargo-installed tauri-driver (default)
   * - 'crabnebula': Use @crabnebula/tauri-driver from npm (enables macOS support)
   * @default 'official'
   */
  driverProvider?: 'official' | 'crabnebula';
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
   * - {@link TauriServiceAPI.resetAllMocks `browser.tauri.resetAllMocks`} - Reset the Tauri API mock functions
   * - {@link TauriServiceAPI.restoreAllMocks `browser.tauri.restoreAllMocks`} - Restore the original Tauri API functionality
   * - {@link TauriServiceAPI.triggerDeeplink `browser.tauri.triggerDeeplink`} - Trigger a deeplink for testing protocol handlers
   */
  tauri: TauriServiceAPI;
}

// Re-export the custom capability for external use
export type { TauriServiceCustomCapability };
