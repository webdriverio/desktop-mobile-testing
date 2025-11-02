import { createLogger } from './log.js';

const log = createLogger('native-utils', 'window');

/**
 * Wait until at least one window handle is available for the given browser instance.
 * This is framework-agnostic and mirrors the readiness check pattern used in Electron.
 *
 * Uses getWindowHandle() instead of getWindowHandles() for better compatibility with
 * drivers that may have issues with getWindowHandles() in multiremote scenarios.
 */
export const waitUntilWindowAvailable = async (browser: WebdriverIO.Browser): Promise<void> => {
  // Extract instance identifier for debugging
  const instanceId =
    (browser as any).capabilities?.['tauri:options']?.args
      ?.find((arg: string) => arg.startsWith('--browser='))
      ?.split('=')[1] || 'unknown';
  const sessionId = (browser as any).sessionId || 'unknown';
  const startTime = Date.now();

  log.debug(`Starting readiness check for instance ${instanceId} (session: ${sessionId.substring(0, 8)}...)`);

  let attemptCount = 0;
  await browser.waitUntil(
    async () => {
      attemptCount++;
      try {
        const handle = await browser.getWindowHandle();
        const elapsed = Date.now() - startTime;
        log.debug(
          `✅ Instance ${instanceId} ready after ${elapsed}ms (${attemptCount} attempts) - handle: ${handle.substring(0, 8)}...`,
        );
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const elapsed = Date.now() - startTime;
        if (errorMessage.includes('invalid session id')) {
          if (attemptCount % 10 === 0 || attemptCount <= 5) {
            // Log every 10th attempt or first 5 attempts
            log.debug(`⚠️  Instance ${instanceId} - invalid session id (attempt ${attemptCount}, ${elapsed}ms elapsed)`);
          }
          return false;
        }
        // For other errors, log and retry
        if (attemptCount <= 3) {
          log.debug(`⚠️  Instance ${instanceId} - error (attempt ${attemptCount}): ${errorMessage}`);
        }
        return false;
      }
    },
    {
      timeout: 30000,
      interval: 250,
      timeoutMsg: `Window handle not available after timeout for instance ${instanceId}`,
    },
  );
};
