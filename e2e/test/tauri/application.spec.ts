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
    // Note: On Windows, Tauri adds '--' prefix to command-line arguments, but not on macOS/Linux
    const args = (await browser.tauri.execute(({ core }) => core.invoke('get_command_line_args'))) as string[];
    // On Windows, msedgedriver treats args as Chrome switches and prepends '--' to each one
    const hasFoo = args.some((arg) => arg === 'foo' || arg === '--foo');
    const hasBar = args.some((arg) => arg === 'bar=baz' || arg === '--bar=baz');
    expect(hasFoo).toBe(true);
    expect(hasBar).toBe(true);
  });
});
