/**
 * Wait until at least one window handle is available for the given browser instance.
 * This is framework-agnostic and mirrors the readiness check pattern used in Electron.
 */
export const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser): Promise<void> => {
  await browser.waitUntil(async () => {
    try {
      const handles = await browser.getWindowHandles();
      return handles.length > 0;
    } catch {
      return false;
    }
  });
};
