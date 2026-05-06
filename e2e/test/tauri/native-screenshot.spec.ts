import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import { assertCapturesChrome, assertOcrContains, assertValidPng, disposeOcr } from '../../lib/screenshotChecks.js';
import { visionAssert, visionEnabled } from '../../lib/visionAssert.js';

const driverProvider = process.env.DRIVER_PROVIDER as 'official' | 'crabnebula' | 'embedded' | undefined;

describe('tauri native screenshot', () => {
  if (process.platform === 'linux') {
    it.skip('skipped on linux (unsupported platform)', () => {});
    return;
  }

  if (driverProvider !== 'embedded') {
    it.skip(`skipped: nativeScreenshot requires the embedded provider (current: ${driverProvider ?? 'unknown'})`, () => {});
    return;
  }

  after(async () => {
    await disposeOcr();
  });

  it('captures the OS window with chrome and matches rendered content', async () => {
    const title = await browser.getTitle();
    expect(title).toMatch(/Tauri.*E2E Test App/);

    // Set counter to a known value so OCR and LLM can assert it
    await browser.tauri.execute(() => {
      const counter = document.querySelector('#counter');
      if (counter) counter.textContent = '7';
    });

    const webviewBase64 = await browser.takeScreenshot();
    const webviewPng = Buffer.from(webviewBase64, 'base64');
    const nativePng = await browser.tauri.nativeScreenshot();

    // Layer 1 — structural: valid PNGs, native is larger (OS chrome adds height), and is a distinct buffer
    const webviewDims = assertValidPng(webviewPng);
    const nativeDims = assertValidPng(nativePng);
    assertCapturesChrome(nativeDims, webviewDims);
    expect(nativePng.equals(webviewPng)).toBe(false);

    // Layer 2 — OCR: fixture content is present in the screenshot
    await assertOcrContains(nativePng, ['tauri', 'e2e test app', 'increment', '7']);

    // Layer 3 — vision LLM: runtime-state-tied assertions (merge-to-main only)
    if (visionEnabled()) {
      try {
        await visionAssert(
          nativePng,
          `Does this image show an OS application window with:
           (a) a title bar at the top of the window,
           (b) a heading containing the words "Tauri" and "E2E Test App",
           (c) a large numeric display showing exactly the number 7?`,
        );
      } catch (err) {
        const out = join(tmpdir(), `tauri-native-screenshot-failure-${Date.now()}.png`);
        writeFileSync(out, nativePng);
        console.error(`[native-screenshot] saved failing screenshot to ${out}`);
        throw err;
      }
    }
  });
});
