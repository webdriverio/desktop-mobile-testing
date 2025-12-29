import type { CdpBridgeOptions } from '@wdio/electron-cdp-bridge';

import type { ElectronServiceGlobalOptions } from '@wdio/native-types';
import { CUSTOM_CAPABILITY_NAME } from './constants.js';

export abstract class ServiceConfig {
  #globalOptions: ElectronServiceGlobalOptions;
  #cdpOptions: CdpBridgeOptions;
  #clearMocks = false;
  #resetMocks = false;
  #restoreMocks = false;
  #browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;

  constructor(baseOptions: ElectronServiceGlobalOptions = {}, capabilities: WebdriverIO.Capabilities) {
    // Merge base options with capability-level options
    // Capability-level options take precedence
    this.#globalOptions = Object.assign({}, baseOptions, capabilities[CUSTOM_CAPABILITY_NAME]);

    const { clearMocks, resetMocks, restoreMocks } = this.#globalOptions;
    this.#clearMocks = clearMocks ?? false;
    this.#resetMocks = resetMocks ?? false;
    this.#restoreMocks = restoreMocks ?? false;

    this.#cdpOptions = {
      ...(this.#globalOptions.cdpBridgeTimeout && { timeout: this.#globalOptions.cdpBridgeTimeout }),
      ...(this.#globalOptions.cdpBridgeWaitInterval && {
        waitInterval: this.#globalOptions.cdpBridgeWaitInterval,
      }),
      ...(this.#globalOptions.cdpBridgeRetryCount && {
        connectionRetryCount: this.#globalOptions.cdpBridgeRetryCount,
      }),
    };
  }

  get globalOptions(): ElectronServiceGlobalOptions {
    return this.#globalOptions;
  }

  get browser(): WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser | undefined {
    return this.#browser;
  }

  set browser(browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser) {
    this.#browser = browser;
  }

  protected get cdpOptions(): CdpBridgeOptions {
    return this.#cdpOptions;
  }

  protected get clearMocks() {
    return this.#clearMocks;
  }

  protected get resetMocks() {
    return this.#resetMocks;
  }

  protected get restoreMocks() {
    return this.#restoreMocks;
  }
}
