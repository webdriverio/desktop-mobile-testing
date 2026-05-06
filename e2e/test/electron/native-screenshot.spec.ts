import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';
import { assertCapturesChrome, assertOcrContains, assertValidPng, disposeOcr } from '../../lib/screenshotChecks.js';
import { visionAssert, visionEnabled } from '../../lib/visionAssert.js';

describe('electron native screenshot', () => {
  if (process.platform === 'linux') {
    it.skip('skipped on linux (unsupported platform)', () => {});
    return;
  }

  after(async () => {
    await disposeOcr();
  });

  it('captures the OS window with chrome and matches rendered content', async () => {
    const title = await browser.getTitle();
    expect(title).toMatch(/Electron.*E2E Test App/);

    const webviewBase64 = await browser.takeScreenshot();
    const webviewPng = Buffer.from(webviewBase64, 'base64');
    const nativePng = await browser.electron.nativeScreenshot();

    // Layer 1 — structural: valid PNG, native captures more height than webview-only
    const webviewDims = assertValidPng(webviewPng);
    const nativeDims = assertValidPng(nativePng);
    assertCapturesChrome(nativeDims, webviewDims);

    // Layer 2 — OCR: fixture content is present in the screenshot
    // The fixture heading is "🚀 Electron Builder E2E" (not "E2E Test App"), so assert
    // the two most reliable OCR tokens from that heading.
    await assertOcrContains(nativePng, ['electron', 'builder']);

    // Layer 3 — vision LLM: runtime-state-tied assertions (merge-to-main only)
    if (visionEnabled()) {
      try {
        await visionAssert(
          nativePng,
          `Does this image show an OS application window with:
           (a) a title bar at the top of the window,
           (b) a heading containing the words "Electron" and "E2E Test App"?`,
        );
      } catch (err) {
        const out = join(tmpdir(), `electron-native-screenshot-failure-${Date.now()}.png`);
        writeFileSync(out, nativePng);
        console.error(`[native-screenshot] saved failing screenshot to ${out}`);
        throw err;
      }
    }
  });
});
