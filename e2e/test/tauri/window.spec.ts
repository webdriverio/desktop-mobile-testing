import { expect } from '@wdio/globals';
import { browser } from '@wdio/tauri-service';

describe('Multi-Window Support', () => {
  beforeEach(async () => {
    // Ensure we're on the main window before each test
    try {
      await browser.tauri.switchWindow('main');
    } catch {
      // If main doesn't exist, continue anyway
    }
  });

  describe('listWindows()', () => {
    it('should list all available windows', async () => {
      const windows = await browser.tauri.listWindows();
      expect(Array.isArray(windows)).toBe(true);
      expect(windows.length).toBeGreaterThanOrEqual(1);
      expect(windows).toContain('main');
    });

    it('should include splash window when available', async () => {
      const windows = await browser.tauri.listWindows();
      // Splash may or may not be enabled depending on build config
      // Just verify it's either present or 'main' is the only window
      if (windows.length > 1) {
        expect(windows).toContain('splash');
      }
    });
  });

  describe('switchWindow()', () => {
    it('should switch to main window', async () => {
      await browser.tauri.switchWindow('main');
      const title = await browser.getTitle();
      expect(title).toMatch(/Tauri.*E2E Test App/);
    });

    it('should switch to splash window when available', async () => {
      const windows = await browser.tauri.listWindows();

      if (!windows.includes('splash')) {
        console.log('[SKIP] Splash window not available in this build');
        return;
      }

      await browser.tauri.switchWindow('splash');
      await expect(browser).toHaveTitle('Splash Screen');
    });

    it('should throw for non-existent window', async () => {
      await expect(browser.tauri.switchWindow('nonexistent-window-12345')).rejects.toThrow();
    });

    it('should be able to switch back to main after switching to splash', async () => {
      const windows = await browser.tauri.listWindows();

      if (!windows.includes('splash')) {
        console.log('[SKIP] Splash window not available');
        return;
      }

      await browser.tauri.switchWindow('splash');
      await expect(browser).toHaveTitle('Splash Screen');

      await browser.tauri.switchWindow('main');
      await expect(browser).toHaveTitle(/Tauri.*E2E Test App/);
    });
  });
});

describe('per-call windowLabel option', () => {
  it('should execute in main window without switching session default', async () => {
    // Execute with explicit windowLabel
    const result = (await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|get_active_window_label'), {
      windowLabel: 'main',
    })) as string;

    expect(result).toBe('main');
  });

  it('should throw when executing in non-existent window', async () => {
    await expect(
      browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|get_active_window_label'), {
        windowLabel: 'nonexistent-window-999',
      }),
    ).rejects.toThrow();
  });

  it('should execute in splash window with per-call option', async () => {
    const windows = await browser.tauri.listWindows();

    if (!windows.includes('splash')) {
      console.log('[SKIP] Splash window not available');
      return;
    }

    const result = (await browser.tauri.execute(({ core }) => core.invoke('plugin:wdio|get_active_window_label'), {
      windowLabel: 'splash',
    })) as string;

    expect(result).toBe('splash');
  });
});

describe('application window tests', () => {
  it('should launch the application splash screen window', async () => {
    const switchButton = await browser.$('.switch-main-window');
    const hasSwitchButton = await switchButton.isExisting();

    const windowHandles = await browser.getWindowHandles();
    const currentTitle = await browser.getTitle();
    console.log('[DEBUG] Window handles:', windowHandles);
    console.log('[DEBUG] Current window title:', currentTitle);
    console.log('[DEBUG] hasSwitchButton:', hasSwitchButton);

    if (!hasSwitchButton) {
      console.log('[DEBUG] Splash not enabled, checking main window title');
      await expect(browser).toHaveTitle(/Tauri.*E2E Test App/);
      return;
    }

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
    const switchButton = await browser.$('.switch-main-window');
    const hasSwitchButton = await switchButton.isExisting();

    if (!hasSwitchButton) {
      console.log('[DEBUG] Splash not enabled, verifying main window');
      const title = await browser.getTitle();
      expect(title).toMatch(/Tauri.*E2E Test App/);
      return;
    }

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
});
