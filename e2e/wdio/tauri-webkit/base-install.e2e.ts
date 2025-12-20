import { execSync } from 'node:child_process';
import { expect } from '@wdio/globals';
import {
  detectPackageManager,
  ensureWebKitWebDriver,
  getWebKitDriverInstallCommand,
} from '@wdio/tauri-service/src/driverManager.js';

describe('WebKitWebDriver fresh installation', () => {
  it('should detect package manager correctly', async function (this: Mocha.Context) {
    this.timeout(30000);

    const pm = await detectPackageManager();
    console.log(`Detected package manager: ${pm}`);

    // Should detect a known package manager on Linux
    expect(pm).not.toBe('unknown');
    expect(['apt', 'dnf', 'yum', 'zypper', 'pacman', 'apk', 'xbps']).toContain(pm);
  });

  it('should provide correct install command for detected package manager', async function (this: Mocha.Context) {
    this.timeout(30000);

    const pm = await detectPackageManager();
    const installCmd = getWebKitDriverInstallCommand(pm);

    console.log(`Package manager: ${pm}`);
    console.log(`Install command: ${installCmd}`);

    // Should contain webkit2gtk-driver
    expect(installCmd).toContain('webkit2gtk-driver');

    // Should start with sudo
    expect(installCmd).toMatch(/^sudo/);
  });

  it('should initially not find WebKitWebDriver in base image', async function (this: Mocha.Context) {
    this.timeout(30000);

    const result = await ensureWebKitWebDriver();
    console.log('Initial detection result:', JSON.stringify(result, null, 2));

    // Should not be found initially (base image doesn't have it)
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.installInstructions).toBeTruthy();
  });

  it('should install WebKitWebDriver using detected package manager', async function (this: Mocha.Context) {
    this.timeout(300000); // 5 minutes for real installation

    const result = await ensureWebKitWebDriver();
    const installCmd = result.installInstructions;

    console.log(`Installing with: ${installCmd}`);

    // Real installation attempt (requires sudo access)
    try {
      execSync(installCmd!, {
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 240000, // 4 minutes
      });
    } catch (error) {
      throw new Error(`Installation failed: ${error}`);
    }

    // Verify installation
    const verifyResult = await ensureWebKitWebDriver();
    console.log('Post-install detection result:', JSON.stringify(verifyResult, null, 2));

    expect(verifyResult.success).toBe(true);
    expect(verifyResult.path).toBeTruthy();
  });

  it('should verify WebKitWebDriver works after installation', async function (this: Mocha.Context) {
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
});
