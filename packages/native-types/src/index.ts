// ============================================================================
// Re-export all types from split files
// ============================================================================

// Electron types
export type {
  ApiCommand,
  AppBuildInfo,
  BinaryPathResult,
  BuilderArch,
  BuilderBuildInfo,
  BuilderConfig,
  Electron,
  ElectronApiFn,
  ElectronBrowserExtension,
  ElectronInterface,
  ElectronMock,
  ElectronMockInstance,
  ElectronServiceAPI,
  ElectronServiceCapabilities,
  ElectronServiceGlobalOptions,
  ElectronServiceOptions,
  ElectronType,
  ExecuteOpts,
  ForgeArch,
  ForgeBuildInfo,
  ForgeConfig,
  PackageJson,
  PathGenerationError,
  PathGenerationErrorType,
  PathGenerationResult,
  PathValidationAttempt,
  PathValidationError,
  PathValidationErrorType,
  PathValidationResult,
  vitestFn,
  WdioElectronConfig,
  WdioElectronWindowObj,
  WebdriverClientFunc,
} from './electron.js';
// Shared types
export type {
  AbstractFn,
  AsyncFn,
  BaseWithExecute,
  BrowserBase,
  ElementBase,
  Fn,
  MockContext,
  MockOverride,
  MockResult,
  SelectorsBase,
} from './shared.js';
export { MockResultType } from './shared.js';

// Tauri types
export type {
  TauriAPIs,
  TauriBrowserExtension,
  TauriResult,
  TauriServiceAPI,
  TauriServiceCapabilities,
  TauriServiceCapabilitiesType,
  TauriServiceCustomCapability,
  TauriServiceGlobalOptions,
  TauriServiceOptions,
  WdioTauriConfig,
} from './tauri.js';

// ============================================================================
// Combined Browser Extension
// ============================================================================

import type { ElectronBrowserExtension } from './electron.js';
import type { TauriBrowserExtension } from './tauri.js';

/**
 * Browser extension that supports both Electron and Tauri services
 */
export interface BrowserExtension extends ElectronBrowserExtension, TauriBrowserExtension {}

// ============================================================================
// Module Augmentation (WebdriverIO)
// ============================================================================

import type { fn as vitestFn } from '@vitest/spy';
import type {
  ElectronInterface,
  ElectronServiceGlobalOptions,
  ElectronServiceOptions,
  ElectronType,
  PackageJson,
  WdioElectronWindowObj,
} from './electron.js';
import type { ElementBase, Fn } from './shared.js';
import type { TauriServiceGlobalOptions, TauriServiceOptions } from './tauri.js';

declare global {
  interface Window {
    wdioElectron: WdioElectronWindowObj;
  }

  // biome-ignore lint/style/noNamespace: This is a legitimate use of namespace for global augmentation
  namespace WebdriverIO {
    interface Browser extends ElectronBrowserExtension, TauriBrowserExtension {}
    interface Element extends ElementBase {}
    interface MultiRemoteBrowser extends ElectronBrowserExtension, TauriBrowserExtension {}
    interface Capabilities {
      'wdio:electronServiceOptions'?: ElectronServiceOptions;
      'wdio:tauriServiceOptions'?: TauriServiceOptions;
    }
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
