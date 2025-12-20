import { execSync } from 'node:child_process';
import { expect } from '@wdio/globals';
import { detectPackageManager, ensureWebKitWebDriver } from '@wdio/tauri-service/src/driverManager.js';

describe('WebKitWebDriver pre-installed detection', () => {
  it('should detect package manager correctly', async function (this: Mocha.Context) {
    this.timeout(30000);

    const pm = await detectPackageManager();
    console.log(`Detected package manager: ${pm}`);

    // Should detect a known package manager
    expect(pm).not.toBe('unknown');
    expect(['apt', 'dnf', 'yum', 'zypper', 'pacman', 'apk', 'xbps']).toContain(pm);
  });

  it('should find pre-installed WebKitWebDriver', async function (this: Mocha.Context) {
    this.timeout(30000);

    const result = await ensureWebKitWebDriver();
    console.log('Detection result:', JSON.stringify(result, null, 2));

    // Should be found (with-webkit image has it pre-installed)
    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();
    expect(result.path).toMatch(/WebKitWebDriver$/);
  });

  it('should verify WebKitWebDriver is in PATH or common locations', async function (this: Mocha.Context) {
    this.timeout(30000);

    const result = await ensureWebKitWebDriver();
    expect(result.success).toBe(true);

    // Should find it via `which` or in common paths
    const commonPaths = [
      '/usr/bin/WebKitWebDriver',
      '/usr/local/bin/WebKitWebDriver',
      '/usr/lib/webkit2gtk-4.0/WebKitWebDriver',
      '/usr/lib/webkit2gtk-4.1/WebKitWebDriver',
    ];

    const foundInCommonPath = commonPaths.some((path) => result.path === path);
    const foundInPath = result.path?.startsWith('/usr');

    expect(foundInCommonPath || foundInPath).toBe(true);
  });

  it('should verify WebKitWebDriver is executable', async function (this: Mocha.Context) {
    this.timeout(60000);

    const result = await ensureWebKitWebDriver();
    expect(result.success).toBe(true);
    expect(result.path).toBeTruthy();

    // Test that WebKitWebDriver binary exists and is executable
    try {
      const version = execSync(`${result.path} --version`, {
        encoding: 'utf8',
        timeout: 10000,
      });
      console.log(`WebKitWebDriver version: ${version.trim()}`);
      expect(version).toBeTruthy();
    } catch (error) {
      throw new Error(`WebKitWebDriver execution failed: ${error}`);
    }
  });

  it('should not require installation when already present', async function (this: Mocha.Context) {
    this.timeout(30000);

    const result = await ensureWebKitWebDriver();

    // Should succeed without needing install instructions
    expect(result.success).toBe(true);
    expect(result.error).toBeFalsy();
    expect(result.installInstructions).toBeFalsy();
  });
});
