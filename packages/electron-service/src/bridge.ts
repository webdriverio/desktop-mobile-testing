import os from 'node:os';
import { CdpBridge } from '@wdio/electron-cdp-bridge';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('electron-service', 'bridge');

import { SevereServiceError } from 'webdriverio';

export const getDebuggerEndpoint = (capabilities: WebdriverIO.Capabilities) => {
  log.trace('Try to detect the node debugger endpoint');

  const debugArg = capabilities['goog:chromeOptions']?.args?.find((item) => item.startsWith('--inspect='));
  log.trace(`Detected debugger args: ${debugArg}`);

  const debugUrl = debugArg ? debugArg.split('=')[1] : undefined;
  const [host, strPort] = debugUrl ? debugUrl.split(':') : [];
  const result = { host, port: Number(strPort) };

  if (!result.host || !result.port) {
    throw new SevereServiceError(`Failed to detect the debugger endpoint.`);
  }

  log.trace(`Detected the node debugger endpoint: `, result);
  return result;
};

export class ElectronCdpBridge extends CdpBridge {
  #contextId: number = 0;

  get contextId() {
    return this.#contextId;
  }

  async connect(): Promise<void> {
    log.debug('CdpBridge options:', this.options);

    await super.connect();
    log.debug('CDP connection established, setting up context handler');

    const contextHandler = this.#getContextIdHandler();
    log.debug('Context handler promise created');

    log.debug('Sending Runtime.enable');
    await this.send('Runtime.enable');
    log.debug('Runtime.enable completed');

    log.debug('Waiting for context ID');
    this.#contextId = await contextHandler;
    log.debug(`Context ID received: ${this.#contextId}`);

    log.debug('Sending Runtime.disable');
    await this.send('Runtime.disable');
    log.debug('Runtime.disable completed');

    await this.send('Runtime.evaluate', {
      expression: getInitializeScript(),
      includeCommandLineAPI: true,
      replMode: true,
      contextId: this.#contextId,
    });
    log.debug('Initialization script executed');
  }

  #getContextIdHandler() {
    return new Promise<number>((resolve, reject) => {
      log.debug(`Setting up Runtime.executionContextCreated listener (timeout: ${this.options.timeout}ms)`);
      let eventCount = 0;
      let firstContextId: number | null = null;
      let resolved = false;

      this.on('Runtime.executionContextCreated', (params) => {
        eventCount++;
        log.debug(`Runtime.executionContextCreated event #${eventCount} received:`, {
          contextId: params.context.id,
          name: params.context.name,
          origin: params.context.origin,
          isDefault: params.context.auxData?.isDefault,
          auxData: params.context.auxData,
        });

        // Store the first context we see as a fallback
        if (firstContextId === null) {
          firstContextId = params.context.id;
          log.debug(`Stored first context ID as fallback: ${firstContextId}`);
        }

        // Prefer contexts marked as default
        if (params.context.auxData?.isDefault) {
          log.debug(`Found default context with ID: ${params.context.id}`);
          resolved = true;
          resolve(params.context.id);
        } else {
          log.debug(`Context is not marked as default, waiting for next event`);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          if (firstContextId !== null) {
            log.warn(
              `No default context found after ${this.options.timeout}ms, using first context ID: ${firstContextId} (received ${eventCount} context events)`,
            );
            resolve(firstContextId);
          } else {
            const err = new Error(
              `Timeout exceeded to get the ContextId after ${this.options.timeout}ms (received ${eventCount} context events)`,
            );
            log.error(err.message);
            reject(err);
          }
        }
      }, this.options.timeout);
    });
  }
}

function getInitializeScript() {
  const scripts = [
    // Add __name to the global object to work around issue with function serialization
    // This enables browser.execute to work with scripts which declare functions (affects TS specs only)
    // https://github.com/webdriverio-community/wdio-electron-service/issues/756
    // https://github.com/privatenumber/tsx/issues/113
    `globalThis.__name = globalThis.__name ?? ((func) => func);`,
    // Add electron to the global object
    `globalThis.electron = require('electron');`,
  ];

  // add because windows is not exposed the process object to global scope
  if (os.type().match('Windows')) {
    scripts.push(`globalThis.process = require('node:process');`);
  }
  return scripts.join('\n');
}
