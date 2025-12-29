import type { OfficialArch } from '@electron/packager';
import type { ForgeConfig as ElectronForgeConfig } from '@electron-forge/shared-types';
import type { Mock, fn as vitestFn } from '@vitest/spy';
import type { Capabilities, Options } from '@wdio/types';
import type { ArchType } from 'builder-util';
import type * as Electron from 'electron';
import type { PackageJson } from 'read-package-up';
import type { AbstractFn, BrowserBase, MockContext, MockOverride, MockResultType } from './shared.js';

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
  /**
   * Enable capture of main process console logs via CDP
   * @default false
   */
  captureMainProcessLogs?: boolean;
  /**
   * Enable capture of renderer process console logs via CDP
   * @default false
   */
  captureRendererLogs?: boolean;
  /**
   * Minimum log level for main process logs
   * @default 'info'
   */
  mainProcessLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Minimum log level for renderer process logs
   * @default 'info'
   */
  rendererLogLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /**
   * Directory for standalone mode logs (when WDIO runner not available)
   * @default './logs'
   */
  logDir?: string;
}

export type ElectronServiceGlobalOptions = Pick<
  ElectronServiceOptions,
  | 'clearMocks'
  | 'resetMocks'
  | 'restoreMocks'
  | 'captureMainProcessLogs'
  | 'captureRendererLogs'
  | 'mainProcessLogLevel'
  | 'rendererLogLevel'
  | 'logDir'
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

// Re-export types needed for global declarations
export type { Electron, PackageJson, vitestFn };
