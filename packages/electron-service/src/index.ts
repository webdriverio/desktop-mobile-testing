import { browser as wdioBrowser } from '@wdio/globals';
// Import types package to ensure module augmentation is loaded
import '@wdio/native-types';
import ElectronLaunchService from './launcher.js';
import ElectronWorkerService from './service.js';
import { init as initSession } from './session.js';

export const launcher = ElectronLaunchService;
export default ElectronWorkerService;

export const browser: WebdriverIO.Browser = wdioBrowser;
export const startWdioSession = initSession;
