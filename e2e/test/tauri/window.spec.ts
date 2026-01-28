import { expect } from '@wdio/globals';
import { browser } from '@wdio/tauri-service';

describe('application window tests', () => {
  it('should launch the application splash screen window', async () => {
    // Check if splash screen is enabled by checking for the switch button
    const switchButton = await browser.$('.switch-main-window');
    // Fix: Use isExisting() to properly check if element exists
    const hasSwitchButton = await switchButton.isExisting();

    // Debug: Log window handles and current state
    const windowHandles = await browser.getWindowHandles();
    const currentTitle = await browser.getTitle();
    console.log('[DEBUG] Window handles:', windowHandles);
    console.log('[DEBUG] Current window title:', currentTitle);
    console.log('[DEBUG] hasSwitchButton:', hasSwitchButton);

    if (!hasSwitchButton) {
      // Splash is not enabled, verify we're on the main window
      console.log('[DEBUG] Splash not enabled, checking main window title');
      await expect(browser).toHaveTitle(/Tauri.*E2E Test App/);
      return;
    }

    // Splash is enabled, verify we're on splash screen
    console.log('[DEBUG] Splash enabled, checking splash window title');
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
    // Fix: Use isExisting() to properly check if element exists
    const hasSwitchButton = await switchButton.isExisting();

    if (!hasSwitchButton) {
      // Splash is not enabled, verify we're already on the main window
      console.log('[DEBUG] Splash not enabled, verifying main window');
      const title = await browser.getTitle();
      expect(title).toMatch(/Tauri.*E2E Test App/);
      return;
    }

    // Splash is enabled, click the switch button
    console.log('[DEBUG] Splash enabled, clicking switch button');
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
