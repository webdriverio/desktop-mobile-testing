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

  // GitHub Actions Windows runners run in a Hyper-V VM with no real graphical session.
  // EnumWindows (and xcap, which wraps it) doesn't enumerate the WebView2 window in this
  // environment — it returns only the GH Actions runner agent and one nameless window
  // owned by a different PID. The capture call itself can't find the target window.
  // Same root cause as the Electron skip; see packages/electron-service/docs/common-issues.md.
  if (process.platform === 'win32' && process.env.CI) {
    it.skip('skipped on Windows CI (no graphical session; EnumWindows misses the Tauri window)', () => {});
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

    // Layer 1 — structural: valid PNGs and a distinct capture
    const webviewDims = assertValidPng(webviewPng);
    const nativeDims = assertValidPng(nativePng);
    // On Windows the title bar adds height above the content area, so we can assert
    // native.height > webview.height. On macOS, Tauri v2 uses fullSizeContentView by
    // default (title bar overlays content rather than stacking above it), making both
    // heights equal — the height check is therefore only valid on Windows.
    if (process.platform === 'win32') {
      assertCapturesChrome(nativeDims, webviewDims);
    }
    expect(nativePng.equals(webviewPng)).toBe(false);

    // Layer 2 — OCR: the native title bar text is visible in the screenshot.
    // xcap uses CGWindowListCreateImage which captures AppKit chrome (title bar) reliably,
    // but WKWebView Metal layers are not composited into that image in CI virtual-display
    // sessions. "tauri" and "e2e test app" come from the native title bar (absent from the
    // webview-only screenshot), so their presence proves OS chrome was captured.
    await assertOcrContains(nativePng, ['tauri', 'e2e test app']);

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
