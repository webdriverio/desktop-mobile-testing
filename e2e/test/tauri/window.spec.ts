import { expect } from '@wdio/globals';
import { browser } from '@wdio/tauri-service';

describe('application window tests', () => {
  it('should launch the application splash screen window', async () => {
    // Check if splash screen is enabled by checking for the switch button
    const switchButton = await browser.$('.switch-main-window');
    const hasSwitchButton = switchButton !== null;

    if (!hasSwitchButton) {
      // Splash is not enabled, verify we're on the main window
      await expect(browser).toHaveTitle(/Tauri.*E2E Test App/);
      return;
    }

    // Splash is enabled, verify we're on splash screen
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
    // Check if splash screen is enabled (has switch button)
    const switchButton = await browser.$('.switch-main-window');
    const hasSwitchButton = switchButton !== null;

    if (!hasSwitchButton) {
      // Splash is not enabled, verify we're already on the main window
      const title = await browser.getTitle();
      expect(title).toMatch(/Tauri.*E2E Test App/);
      return;
    }

    // Splash is enabled, click the switch button
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
