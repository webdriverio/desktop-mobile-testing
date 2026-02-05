import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';

declare global {
  var receivedDeeplinks: string[];
  var deeplinkCount: number;
}

async function clearDeeplinkState() {
  await browser.tauri.execute(() => {
    globalThis.receivedDeeplinks = [];
    globalThis.deeplinkCount = 0;
  });
}

async function waitForDeeplink(expectedCount = 1, timeoutMsg = 'App did not receive the deeplink') {
  await browser.waitUntil(
    async () => {
      const count = await browser.tauri.execute(() => globalThis.deeplinkCount ?? 0);
      return count >= expectedCount;
    },
    {
      timeout: 30000, // 30 seconds - protocol handler invocation can be slow on CI
      timeoutMsg,
    },
  );
}

describe('Deeplink Testing (browser.tauri.triggerDeeplink)', () => {
  beforeEach(async () => {
    await clearDeeplinkState();
  });

  describe('Basic Deeplink Functionality', () => {
    it('should trigger a simple deeplink', async () => {
      await browser.tauri.triggerDeeplink('testapp://simple');
      await waitForDeeplink(1, 'App did not receive the deeplink within 5 seconds');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      expect(deeplinks).toContain('testapp://simple');
    });

    it('should handle deeplinks with paths', async () => {
      await browser.tauri.triggerDeeplink('testapp://open/file/path');
      await waitForDeeplink(1, 'App did not receive the deeplink with path');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      expect(deeplinks).toContain('testapp://open/file/path');
    });
  });

  describe('URL Parameter Preservation', () => {
    it('should preserve simple query parameters', async () => {
      await browser.tauri.triggerDeeplink('testapp://action?param1=value1&param2=value2');
      await waitForDeeplink(1, 'App did not receive the deeplink with parameters');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      const receivedUrl = deeplinks[0];

      expect(receivedUrl).toContain('param1=value1');
      expect(receivedUrl).toContain('param2=value2');
    });

    it('should preserve complex query parameters', async () => {
      const complexUrl = 'testapp://action?name=John%20Doe&age=30&tags[]=tag1&tags[]=tag2';
      await browser.tauri.triggerDeeplink(complexUrl);
      await waitForDeeplink(1, 'App did not receive the complex deeplink');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      const receivedUrl = deeplinks[0];

      expect(receivedUrl).toMatch(/name=John(\+|%20)Doe/);
      expect(receivedUrl).toContain('age=30');
      expect(receivedUrl).toContain('tags');
    });

    it('should preserve URL fragments', async () => {
      await browser.tauri.triggerDeeplink('testapp://page?section=intro#heading');
      await waitForDeeplink(1, 'App did not receive the deeplink with fragment');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      const receivedUrl = deeplinks[0];

      expect(receivedUrl).toContain('section=intro');
      expect(receivedUrl).toContain('#heading');
    });
  });

  describe('Multiple Deeplinks', () => {
    it('should handle multiple deeplinks in sequence', async () => {
      await browser.tauri.triggerDeeplink('testapp://first');
      await waitForDeeplink(1, 'App did not receive first deeplink');

      await browser.tauri.triggerDeeplink('testapp://second');
      await waitForDeeplink(2, 'App did not receive second deeplink');

      await browser.tauri.triggerDeeplink('testapp://third');
      await waitForDeeplink(3, 'App did not receive third deeplink');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      expect(deeplinks).toHaveLength(3);
      expect(deeplinks).toContain('testapp://first');
      expect(deeplinks).toContain('testapp://second');
      expect(deeplinks).toContain('testapp://third');
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid URL format', async () => {
      await expect(browser.tauri.triggerDeeplink('not a valid url')).rejects.toThrow();
    });

    it('should reject http protocol', async () => {
      await expect(browser.tauri.triggerDeeplink('http://example.com')).rejects.toThrow(/Invalid deeplink protocol/);
    });

    it('should reject https protocol', async () => {
      await expect(browser.tauri.triggerDeeplink('https://example.com')).rejects.toThrow(/Invalid deeplink protocol/);
    });

    it('should reject file protocol', async () => {
      await expect(browser.tauri.triggerDeeplink('file:///path/to/file')).rejects.toThrow(/Invalid deeplink protocol/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle URLs with special characters', async () => {
      const specialUrl = 'testapp://test?message=Hello%20World%21&emoji=%F0%9F%9A%80';
      await browser.tauri.triggerDeeplink(specialUrl);
      await waitForDeeplink(1, 'App did not receive the deeplink with special characters');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      expect(deeplinks).toHaveLength(1);
      expect(deeplinks[0]).toMatch(/message=Hello(\+|%20)World/);
    });

    it('should handle URLs with no path or parameters', async () => {
      await browser.tauri.triggerDeeplink('testapp://');
      await waitForDeeplink(1, 'App did not receive minimal deeplink');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      expect(deeplinks).toContain('testapp://');
    });

    it('should handle URLs with empty parameter values', async () => {
      await browser.tauri.triggerDeeplink('testapp://test?empty=&filled=value');
      await waitForDeeplink(1, 'App did not receive deeplink with empty parameters');

      const deeplinks = await browser.tauri.execute(() => globalThis.receivedDeeplinks);
      const receivedUrl = deeplinks[0];

      expect(receivedUrl).toContain('empty=');
      expect(receivedUrl).toContain('filled=value');
    });
  });
});
