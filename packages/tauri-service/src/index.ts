export {
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
  getTauriDriverPath,
  isTauriAppBuilt,
} from './pathResolver.js';
// Export the worker service as default
// Export the browser extension
export { default, default as browser } from './service.js';
// Export session management
export {
  createTauriCapabilities,
  getTauriServiceStatus,
  init as session,
} from './session.js';
// Export types
export type {
  TauriAppInfo,
  TauriCapabilities,
  TauriCommandContext,
  TauriDriverProcess,
  TauriResult,
  TauriServiceGlobalOptions,
  TauriServiceOptions,
} from './types.js';
