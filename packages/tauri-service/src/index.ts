// Import types package to ensure module augmentation is loaded
import { browser as wdioBrowser } from '@wdio/globals';
import '@wdio/native-types';

export {
  execute,
  executeTauriCommand,
  executeTauriCommands,
  executeTauriCommandsParallel,
  executeTauriCommandWithTimeout,
  getTauriAppInfo as getTauriAppInfoFromBrowser,
  getTauriVersion,
  isTauriApiAvailable,
} from './commands/execute.js';
export { default as launcher } from './launcher.js';
// Export utilities
export {
  getTauriAppInfo,
  getTauriBinaryPath,
  isTauriAppBuilt,
} from './pathResolver.js';
// Export the worker service as default
export { default } from './service.js';
// Export the browser extension
export const browser: WebdriverIO.Browser = wdioBrowser;
// Re-export types from @wdio/native-types
export type {
  TauriAPIs,
  TauriResult,
  TauriServiceAPI,
  TauriServiceCapabilities,
  TauriServiceGlobalOptions,
  TauriServiceOptions,
} from '@wdio/native-types';
// Export session management
export {
  cleanup as cleanupWdioSession,
  createTauriCapabilities,
  getTauriServiceStatus,
  init as startWdioSession,
} from './session.js';

// Export types from local types file
export type {
  TauriAppInfo,
  TauriCapabilities,
  TauriCommandContext,
  TauriDriverProcess,
} from './types.js';
