import type { TauriMock } from '@wdio/native-types';
import { createLogger } from '@wdio/native-utils';
import { createMock } from '../mock.js';
import mockStore from '../mockStore.js';

const log = createLogger('tauri-service', 'mock');

interface TauriServiceContext {
  browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;
}

export async function mock(this: TauriServiceContext, command: string): Promise<TauriMock> {
  log.debug(`[${command}] mock command called`);
  // First try returning an existing mock without requiring a browser context
  try {
    // Retrieve an existing mock from the store
    const existingMock = mockStore.getMock(`tauri.${command}`);
    log.debug(`[${command}] Found existing mock, resetting`);
    await existingMock.mockReset();
    return existingMock;
  } catch (_e) {
    // No existing mock, determine browser context now
    log.debug(`[${command}] No existing mock found, determining browser context`);
    let browserContext: WebdriverIO.Browser | undefined;
    // Prefer this.browser if it has tauri capabilities
    if (
      this &&
      this.browser &&
      !this.browser.isMultiremote &&
      this.browser.tauri &&
      typeof this.browser.tauri.execute === 'function'
    ) {
      browserContext = this.browser as WebdriverIO.Browser;
    } else if (
      globalThis.browser &&
      (globalThis.browser as WebdriverIO.Browser).tauri &&
      typeof (globalThis.browser as WebdriverIO.Browser).tauri.execute === 'function'
    ) {
      browserContext = globalThis.browser as WebdriverIO.Browser;
    } else if (globalThis.browser && !(globalThis.browser as unknown as WebdriverIO.MultiRemoteBrowser).isMultiremote) {
      browserContext = globalThis.browser as WebdriverIO.Browser;
    } else if (this?.browser && !this.browser.isMultiremote) {
      browserContext = this.browser as WebdriverIO.Browser;
    }

    // Create a new mock and store it
    log.debug(`[${command}] Creating new mock`);
    const newMock = await createMock(command, browserContext);
    mockStore.setMock(newMock);
    return newMock;
  }
}

export async function clearAllMocks(this: TauriServiceContext): Promise<void> {
  log.debug('clearAllMocks command called');
  const mocks = mockStore.getMocks();

  for (const [, mock] of mocks) {
    await mock.mockClear();
  }

  log.debug(`clearAllMocks completed - cleared ${mocks.length} mocks`);
}

export async function resetAllMocks(this: TauriServiceContext): Promise<void> {
  log.debug('resetAllMocks command called');
  const browserContext = this?.browser || globalThis.browser;

  if (!browserContext || browserContext.isMultiremote) {
    throw new Error('resetAllMocks requires a valid browser context');
  }

  // Reset all mocks in the injection script
  await (browserContext as WebdriverIO.Browser).execute<void, []>(() => {
    // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
    if (window.__wdio_mocks__) {
      // @ts-expect-error - Reset each mock
      for (const mock of Object.values(window.__wdio_mocks__)) {
        // @ts-expect-error - mock has mockReset method
        if (mock && typeof mock.mockReset === 'function') {
          // @ts-expect-error - mock has mockReset method
          mock.mockReset();
        }
      }
    }
  });

  // Reset all outer mocks
  const mocks = mockStore.getMocks();
  for (const [, mock] of mocks) {
    await mock.mockReset();
  }

  log.debug(`resetAllMocks completed - reset ${mocks.length} mocks`);
}

export async function restoreAllMocks(this: TauriServiceContext): Promise<void> {
  log.debug('restoreAllMocks command called');
  const browserContext = this?.browser || globalThis.browser;

  if (!browserContext || browserContext.isMultiremote) {
    throw new Error('restoreAllMocks requires a valid browser context');
  }

  // Restore all mocks in the injection script
  await (browserContext as WebdriverIO.Browser).execute<void, []>(() => {
    // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
    if (window.__wdio_mocks__) {
      // @ts-expect-error - window.__wdio_mocks__ is defined by injection script
      window.__wdio_mocks__ = {};
    }
  });

  // Restore all outer mocks
  const mocks = mockStore.getMocks();
  for (const [, mock] of mocks) {
    await mock.mockRestore();
  }

  log.debug(`restoreAllMocks completed - restored ${mocks.length} mocks`);
}

export async function isMockFunction(this: TauriServiceContext, command: string): Promise<boolean> {
  try {
    const existingMock = mockStore.getMock(`tauri.${command}`);
    return existingMock.__isTauriMock === true;
  } catch (_e) {
    return false;
  }
}
