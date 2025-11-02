/**
 * Wait until at least one window handle is available for the given browser instance.
 * This is framework-agnostic and mirrors the readiness check pattern used in Electron.
 *
 * Uses getWindowHandle() instead of getWindowHandles() for better compatibility with
 * drivers that may have issues with getWindowHandles() in multiremote scenarios.
 */
export const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser): Promise<void> => {
  await browser.waitUntil(
    async () => {
      try {
        await browser.getWindowHandle();
        return true;
      } catch {
        return false;
      }
    },
    {
      timeout: 30000,
      interval: 250,
      timeoutMsg: 'Window handle not available after timeout',
    },
  );
};
