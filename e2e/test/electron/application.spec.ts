import { browser } from '@wdio/electron-service';
import { expect } from '@wdio/globals';

describe('application', () => {
  it('should launch the application', async () => {
    // Verify the app launched with an Electron E2E test app title
    const title = await browser.getTitle();
    expect(title).toMatch(/Electron.*E2E Test App/);
  });

  it('should pass args through to the launched application', async () => {
    // custom args are set in the wdio.conf.js file as they need to be set before WDIO starts
    const argv = await browser.electron.execute(() => process.argv);
    expect(argv).toContain('--foo');
    expect(argv).toContain('--bar=baz');
  });
});
