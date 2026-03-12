import { browser, expect } from '@wdio/globals';
import '@wdio/native-types';

describe('Tauri application', () => {
  it('should launch the application', async () => {
    // Verify the app launched with a Tauri E2E test app
    const title = await browser.getTitle();
    expect(title).toMatch(/Tauri.*E2E Test App/);
  });

  it('should pass args through to the launched application', async () => {
    // custom args are set in the wdio.tauri.conf.ts file as they need to be set before WDIO starts
    const args = (await browser.tauri.execute(({ core }) => core.invoke('get_command_line_args'))) as string[];
    expect(args).toContain('foo');
    expect(args).toContain('bar=baz');
  });
});
