import { expect } from '@wdio/globals';
import { browser } from '@wdio/tauri-service';

describe('application window tests', () => {
  // Skip splash screen test if ENABLE_SPLASH_WINDOW is not set
  const isSplashEnabled = process.env.ENABLE_SPLASH_WINDOW === 'true';

  it('should launch the application splash screen window', async function () {
    if (!isSplashEnabled) {
      return this.skip(); // Skip if splash screen not enabled
    }
    if (browser.isMultiremote) {
      const multi = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      const browserA = multi.getInstance('browserA');
      const browserB = multi.getInstance('browserB');
      await expect(browserA).toHaveTitle('Splash Screen');
      await expect(browserB).toHaveTitle('Splash Screen');
    } else {
      await expect(browser).toHaveTitle('Splash Screen');
    }
  });

  it('should switch to the application main window', async () => {
    if (browser.isMultiremote) {
      const multi = browser as unknown as WebdriverIO.MultiRemoteBrowser;
      const browserA = multi.getInstance('browserA');
      const browserB = multi.getInstance('browserB');
      await (await browserA.$('.switch-main-window')).click();
      await (await browserB.$('.switch-main-window')).click();
      const titleA = await browserA.getTitle();
      const titleB = await browserB.getTitle();
      expect(titleA).toMatch(/Tauri.*E2E Test App/);
      expect(titleB).toMatch(/Tauri.*E2E Test App/);
    } else {
      const elem = await browser.$('.switch-main-window');
      await elem.click();
      const title = await browser.getTitle();
      expect(title).toMatch(/Tauri.*E2E Test App/);
    }
  });

  it('should list all window labels', async () => {
    const windows = (await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|list_windows'))) as string[];
    expect(Array.isArray(windows)).toBe(true);
    expect(windows.length).toBeGreaterThanOrEqual(1);
  });

  it('should get active window label', async () => {
    const label = (await browser.tauri.execute(({ core }) =>
      core.invoke('plugin:wdio|get_active_window_label'),
    )) as string;
    expect(typeof label).toBe('string');
  });
});
