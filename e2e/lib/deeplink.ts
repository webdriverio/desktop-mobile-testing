/**
 * Shared deeplink testing helpers for Electron and Tauri
 */

/**
 * Type for the electron/tauri API context accessor
 */
type ContextAccessor = () => { execute<T>(fn: (context: unknown) => T | undefined): Promise<T | undefined> };

/**
 * Create deeplink test helpers for a given context accessor
 */
export function createDeeplinkHelpers(contextAccessor: ContextAccessor) {
  const getContext = contextAccessor;

  /**
   * Helper: Wait for a specific number of deeplinks to be received
   */
  async function waitForDeeplink(expectedCount = 1, timeoutMsg = 'App did not receive the deeplink') {
    const ctx = getContext();
    await browser.waitUntil(
      async () => {
        const count = (await ctx.execute(() => (globalThis as { deeplinkCount?: number }).deeplinkCount)) ?? 0;
        return count >= expectedCount;
      },
      {
        timeout: 30000,
        timeoutMsg,
      },
    );
  }

  /**
   * Helper: Wait for deeplink state to stabilize (no more incoming deeplinks)
   */
  async function waitForDeeplinkStability() {
    const ctx = getContext();
    let previousCount = (await ctx.execute(() => (globalThis as { deeplinkCount?: number }).deeplinkCount)) ?? 0;

    await browser.waitUntil(
      async () => {
        await browser.pause(1000);
        const currentCount = (await ctx.execute(() => (globalThis as { deeplinkCount?: number }).deeplinkCount)) ?? 0;
        const isStable = currentCount === previousCount;
        previousCount = currentCount;
        return isStable;
      },
      {
        timeout: 5000,
        timeoutMsg: 'Deeplink state did not stabilize',
      },
    );
  }

  /**
   * Helper: Clear deeplink state
   */
  async function clearDeeplinkState() {
    const ctx = getContext();
    await ctx.execute(() => {
      globalThis.receivedDeeplinks = [];
      globalThis.deeplinkCount = 0;
    });
  }

  return {
    waitForDeeplink,
    waitForDeeplinkStability,
    clearDeeplinkState,
  };
}
