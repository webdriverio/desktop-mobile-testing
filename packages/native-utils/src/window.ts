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
        // Use getWindowHandle() instead of getWindowHandles() for better compatibility
        // Some drivers (like tauri-driver) may have issues with getWindowHandles()
        // in multiremote scenarios where sessions can become temporarily invalid
        await browser.getWindowHandle();
        return true;
      } catch (error) {
        // Retry on "invalid session id" errors - these can be transient in multiremote
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('invalid session id')) {
          // Return false to retry, but this is expected and will be retried by waitUntil
          return false;
        }
        // For other errors, also retry (but log if needed)
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
