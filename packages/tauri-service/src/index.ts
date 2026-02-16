// Import types package to ensure module augmentation is loaded
import { browser as wdioBrowser } from '@wdio/globals';
import '@wdio/native-types';

export { default as launcher } from './launcher.js';
export {
  getTauriAppInfo,
  getTauriBinaryPath,
} from './pathResolver.js';
export { default } from './service.js';
export {
  cleanup as cleanupWdioSession,
  createTauriCapabilities,
  init as startWdioSession,
} from './session.js';
export const browser: WebdriverIO.Browser = wdioBrowser;
export type {
  TauriAppInfo,
  TauriCapabilities,
  TauriServiceGlobalOptions,
  TauriServiceOptions,
} from './types.js';
