import { browser } from '@wdio/electron-service';
import { expect } from '@wdio/globals';

describe('application window tests', () => {
  it('should launch the application splash screen window', async () => {
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
      // Verify the app switched to main window with an Electron E2E test app title
      const titleA = await browserA.getTitle();
      const titleB = await browserB.getTitle();
      expect(titleA).toMatch(/Electron.*E2E Test App/);
      expect(titleB).toMatch(/Electron.*E2E Test App/);
    } else {
      const elem = await browser.$('.switch-main-window');
      await elem.click();
      // Verify the app switched to main window with an Electron E2E test app title
      const title = await browser.getTitle();
      expect(title).toMatch(/Electron.*E2E Test App/);
    }
  });
});
