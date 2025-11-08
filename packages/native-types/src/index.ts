import type { OfficialArch } from '@electron/packager';
import type { ForgeConfig as ElectronForgeConfig } from '@electron-forge/shared-types';
import type { Mock, fn as vitestFn } from '@vitest/spy';
import type { Capabilities, Options } from '@wdio/types';
import type { ArchType } from 'builder-util';
import type * as Electron from 'electron';
import type { PackageJson } from 'read-package-up';

import type { ChainablePromiseArray, ChainablePromiseElement } from 'webdriverio';

// ============================================================================
// Shared Base Types
// ============================================================================

export type Fn = (...args: unknown[]) => unknown;
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
export type AbstractFn = Fn | AsyncFn;

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

// ============================================================================
// Shared Mock Infrastructure
// ============================================================================

/**
 * Mock result type - shared between Electron and Tauri mocking
 */
export enum MockResultType {
  Return = 'return',
  Throw = 'throw',
}

/**
 * Mock result - shared between Electron and Tauri mocking
 */
export type MockResult = {
  type: MockResultType;
  value: unknown;
};

/**
 * Mock context - shared between Electron and Tauri mocking
 */
export interface MockContext {
  /**
   * This is an array containing all arguments for each call. Each item of the array is the arguments of that call.
   */
  calls: unknown[][];
  /**
   * The order of mock invocation. This returns an array of numbers that are shared between all defined mocks. Will return an empty array if the mock was never invoked.
   */
  invocationCallOrder: number[];
  /**
   * This is an array containing all values that were returned from the mock. Each item of the array is an object with the properties type and value.
   */
  results: MockResult[];
  /**
   * This contains the arguments of the last call. If the mock wasn't called, it will return `undefined`.
   */
  lastCall: unknown;
}

/**
 * Override types for mock methods
 */
export type MockOverride =
  | 'mockImplementation'
  | 'mockImplementationOnce'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce'
  | 'mockClear'
  | 'mockReset'
  | 'mockReturnThis'
  | 'mockName'
  | 'withImplementation'
  | 'mock';

// ============================================================================
// Electron-Specific Types
// ============================================================================

export type ElectronApiFn = ElectronType[ElectronInterface][keyof ElectronType[ElectronInterface]];

export interface ElectronServiceAPI {
  /**
   * The window handle of the Electron window.
   */
  windowHandle?: string;
  /**
   * Mock a function from the Electron API.
   *
   * @param apiName name of the API to mock
   * @param funcName name of the function to mock
   * @param mockReturnValue value to return when the mocked function is called
   * @returns a {@link Promise} that resolves once the mock is registered
   */
  mock: <Interface extends ElectronInterface>(
    apiName: Interface,
    funcName?: string,
    returnValue?: unknown,
  ) => Promise<ElectronMock>;
  /**
   * Mock all functions from an Electron API.
   *
   * @param apiName name of the API to mock
   * @returns a {@link Promise} that resolves once the mock is registered
   */
  mockAll: <Interface extends ElectronInterface>(apiName: Interface) => Promise<Record<string, ElectronMock>>;
  /**
   * Execute a function within the Electron main process.
   *
   * @param script function to execute
   * @param args function arguments
   */
  execute<ReturnValue, InnerArguments extends unknown[]>(
    script: string | ((electron: typeof Electron, ...innerArgs: InnerArguments) => ReturnValue),
    ...args: InnerArguments
  ): Promise<ReturnValue>;
  /**
   * Clear mocked Electron API function(s).
   *
   * @param apiName mocked api to clear
   */
  clearAllMocks: (apiName?: string) => Promise<void>;
  /**
   * Reset mocked Electron API function(s).
   *
   * @param apiName mocked api to reset
   */
  resetAllMocks: (apiName?: string) => Promise<void>;
  /**
   * Restore mocked Electron API function(s).
   *
   * @param apiName mocked api to remove
   */
  restoreAllMocks: (apiName?: string) => Promise<void>;
  /**
   * Checks that a given parameter is an Electron mock function. If you are using TypeScript, it will also narrow down its type.
   */
  isMockFunction: (fn: unknown) => fn is ElectronMockInstance;
}

/**
 * The options for the Electron Service.
 */
export interface ElectronServiceOptions {
  /**
   * An array of string arguments to be passed through to the app on execution of the test run.
   * Electron [command line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)
   * and some [Chromium switches](https://peter.sh/experiments/chromium-command-line-switches) can be
   * used here.
   */
  appArgs?: string[];
  /**
   * The path to the electron binary of the app for testing.
   */
  appBinaryPath?: string;
  /**
   * The path to the electron entry point of the app for testing.
   */
  appEntryPoint?: string;
  /**
   * Calls .mockClear() on all mocked APIs before each test. This will clear mock history, but not reset its implementation.
   */
  clearMocks?: boolean;
  /**
   * Calls .mockReset() on all mocked APIs before each test. This will clear mock history and reset its implementation to an empty function (will return undefined).
   */
  resetMocks?: boolean;
  /**
   * Calls .mockRestore() on all mocked APIs before each test. This will restore the original API function, the mock will be removed.
   */
  restoreMocks?: boolean;
}

export type ElectronServiceGlobalOptions = Pick<
  ElectronServiceOptions,
  'clearMocks' | 'resetMocks' | 'restoreMocks'
> & {
  rootDir?: string;
  /**
   * Timeout for any request using CdpBridge to a node debugger.
   */
  cdpBridgeTimeout?: number;
  /**
   * Interval in milliseconds to wait between attempts to connect to the node debugger.
   */
  cdpBridgeWaitInterval?: number;
  /**
   * Number of attempts to connect to the node debugger before giving up.
   */
  cdpBridgeRetryCount?: number;
  /**
   * Control automatic installation of AppArmor profiles on Linux if needed.
   * When false, the service will warn and continue without installing.
   * @default false
   * - false (default): never install; warn and continue without AppArmor profile
   * - true: install only if running as root (no sudo)
   * - 'sudo': install if root or via non-interactive sudo (`sudo -n`) if available
   */
  apparmorAutoInstall?: boolean | 'sudo';
};

export type ApiCommand = { name: string; bridgeProp: string };
export type WebdriverClientFunc = (this: WebdriverIO.Browser, ...args: unknown[]) => Promise<unknown>;

export type ElectronType = typeof Electron;
export type ElectronInterface = keyof ElectronType;

export type BuilderConfig = {
  productName?: string;
  directories?: { output?: string };
  executableName?: string;
};

export type ForgeConfig = ElectronForgeConfig;

export type BuilderArch = ArchType;
export type ForgeArch = OfficialArch;

export type ForgeBuildInfo = {
  appName: string;
  config: ForgeConfig;
  isBuilder: false;
  isForge: true;
};

export type BuilderBuildInfo = {
  appName: string;
  config: BuilderConfig;
  isBuilder: true;
  isForge: false;
};

export type AppBuildInfo = ForgeBuildInfo | BuilderBuildInfo;

// Binary Path Result Types
export type PathGenerationErrorType =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'CONFIG_WARNING'
  | 'MULTIPLE_BUILD_TOOLS'
  | 'NO_BUILD_TOOL'
  | 'UNSUPPORTED_PLATFORM';

export type PathValidationErrorType =
  | 'FILE_NOT_FOUND'
  | 'NOT_EXECUTABLE'
  | 'PERMISSION_DENIED'
  | 'IS_DIRECTORY'
  | 'ACCESS_ERROR';

export interface PathGenerationError {
  type: PathGenerationErrorType;
  message: string;
  buildTool?: string;
  details?: string;
}

export interface PathValidationError {
  type: PathValidationErrorType;
  message: string;
  code?: string;
  permissions?: string;
  details?: string;
}

export interface PathValidationAttempt {
  path: string;
  valid: boolean;
  error?: PathValidationError;
}

export interface PathGenerationResult {
  success: boolean;
  paths: string[];
  errors: PathGenerationError[];
}

export interface PathValidationResult {
  success: boolean;
  validPath?: string;
  attempts: PathValidationAttempt[];
}

export interface BinaryPathResult {
  success: boolean;
  binaryPath?: string;
  pathGeneration: PathGenerationResult;
  pathValidation: PathValidationResult;
}

export type ExecuteOpts = {
  internal?: boolean;
};

export type WdioElectronWindowObj = {
  execute: (script: string, args?: unknown[]) => unknown;
};

type ElectronMockResult = {
  type: MockResultType;
  value: unknown;
};

interface ElectronMockContext extends MockContext {
  results: ElectronMockResult[];
}

export interface ElectronMockInstance extends Omit<Mock, MockOverride> {
  mockImplementation(fn: AbstractFn): Promise<ElectronMock>;
  mockImplementationOnce(fn: AbstractFn): Promise<ElectronMock>;
  mockReturnValue(obj: unknown): Promise<ElectronMock>;
  mockReturnValueOnce(obj: unknown): Promise<ElectronMock>;
  mockResolvedValue(obj: unknown): Promise<ElectronMock>;
  mockResolvedValueOnce(obj: unknown): Promise<ElectronMock>;
  mockRejectedValue(obj: unknown): Promise<ElectronMock>;
  mockRejectedValueOnce(obj: unknown): Promise<ElectronMock>;
  mockClear(): Promise<ElectronMock>;
  mockReset(): Promise<ElectronMock>;
  mockRestore(): Promise<ElectronMock>;
  mockReturnThis(): Promise<unknown>;
  withImplementation<ReturnValue, InnerArguments extends unknown[]>(
    implFn: AbstractFn,
    callbackFn: (electron: typeof Electron, ...innerArgs: InnerArguments) => ReturnValue,
  ): Promise<unknown>;
  mockName(name: string): ElectronMock;
  getMockName(): string;
  getMockImplementation(): AbstractFn;
  update(): Promise<ElectronMock>;
  mock: ElectronMockContext;
  __isElectronMock: boolean;
}

export interface ElectronMock<TArgs extends unknown[] = unknown[], TReturns = unknown> extends ElectronMockInstance {
  new (...args: TArgs): TReturns;
  (...args: TArgs): TReturns;
}

type ElectronServiceCustomCapability = {
  /**
   * custom capabilities to configure the Electron service
   */
  'wdio:electronServiceOptions'?: ElectronServiceOptions;
};

type ElectronServiceRequestedStandaloneCapabilities = Capabilities.RequestedStandaloneCapabilities &
  ElectronServiceCustomCapability;
type ElectronServiceRequestedMultiremoteCapabilities = Capabilities.RequestedMultiremoteCapabilities &
  ElectronServiceCustomCapability;

export type ElectronServiceCapabilities =
  | ElectronServiceRequestedStandaloneCapabilities[]
  | ElectronServiceRequestedMultiremoteCapabilities
  | ElectronServiceRequestedMultiremoteCapabilities[];

export type WdioElectronConfig = Options.Testrunner & {
  capabilities: ElectronServiceCapabilities | ElectronServiceCapabilities[];
};

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

// ============================================================================
// Browser Extension Types (Combined)
// ============================================================================

/**
 * Browser extension that supports both Electron and Tauri services
 */
/**
 * Browser extension for Electron service
 */
export interface ElectronBrowserExtension extends BrowserBase {
  /**
   * Access the WebdriverIO Electron Service API.
   *
   * - {@link ElectronServiceAPI.clearAllMocks `browser.electron.clearAllMocks`} - Clear the Electron API mock functions
   * - {@link ElectronServiceAPI.execute `browser.electron.execute`} - Execute code in the Electron main process context
   * - {@link ElectronServiceAPI.mock `browser.electron.mock`} - Mock a function from the Electron API, e.g. `dialog.showOpenDialog`
   * - {@link ElectronServiceAPI.mockAll `browser.electron.mockAll`} - Mock an entire API object of the Electron API, e.g. `app` or `dialog`
   * - {@link ElectronServiceAPI.resetAllMocks `browser.electron.resetAllMocks`} - Reset the Electron API mock functions
   * - {@link ElectronServiceAPI.restoreAllMocks `browser.electron.restoreAllMocks`} - Restore the original Electron API functionality
   * - {@link ElectronServiceAPI.windowHandle `browser.electron.windowHandle`} - Get the current window handle
   */
  electron: ElectronServiceAPI;
}

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
   */
  tauri: TauriServiceAPI;
}

/**
 * Browser extension that supports both Electron and Tauri services
 */
export interface BrowserExtension extends ElectronBrowserExtension, TauriBrowserExtension {}

// ============================================================================
// Module Augmentation
// ============================================================================

declare global {
  interface Window {
    wdioElectron: WdioElectronWindowObj;
  }

  // biome-ignore lint/style/noNamespace: This is a legitimate use of namespace for global augmentation
  namespace WebdriverIO {
    interface Browser extends ElectronBrowserExtension, TauriBrowserExtension {}
    interface Element extends ElementBase {}
    interface MultiRemoteBrowser extends ElectronBrowserExtension, TauriBrowserExtension {}
    interface Capabilities extends ElectronServiceCustomCapability, TauriServiceCustomCapability {}
    interface ServiceOption extends ElectronServiceGlobalOptions, TauriServiceGlobalOptions {}
  }

  var __name: (func: Fn) => Fn;
  var browser: WebdriverIO.Browser;
  var fn: typeof vitestFn;
  var originalApi: Record<ElectronInterface, ElectronType[ElectronInterface]>;
  var packageJson: PackageJson;
}

/**
 * Version constant to ensure the module has runtime code
 * This is needed for bundlers that require at least one runtime export
 */
export const __nativeTypesVersion = '9.2.0';
