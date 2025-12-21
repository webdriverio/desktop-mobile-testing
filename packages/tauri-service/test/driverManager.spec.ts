import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureWebKitWebDriver, getWebKitDriverInstallCommand } from '../src/driverManager.js';

describe('WebKitWebDriver Management', () => {
  describe('getWebKitDriverInstallCommand', () => {
    it('should return correct install command for apt (Debian/Ubuntu)', () => {
      const command = getWebKitDriverInstallCommand('apt');
      expect(command).toBe('sudo apt-get install -y webkit2gtk-driver');
    });

    it('should return correct install command for dnf (Fedora)', () => {
      const command = getWebKitDriverInstallCommand('dnf');
      expect(command).toBe('sudo dnf install -y webkit2gtk-driver');
    });

    it('should return correct install command for yum (CentOS/RHEL)', () => {
      const command = getWebKitDriverInstallCommand('yum');
      expect(command).toBe('sudo yum install -y webkit2gtk-driver');
    });

    it('should return correct install command for zypper (SUSE)', () => {
      const command = getWebKitDriverInstallCommand('zypper');
      expect(command).toBe('sudo zypper install -y webkit2gtk-driver');
    });

    it('should return correct install command for pacman (Arch)', () => {
      const command = getWebKitDriverInstallCommand('pacman');
      expect(command).toBe('sudo pacman -S webkit2gtk-driver');
    });

    it('should return correct install command for apk (Alpine)', () => {
      const command = getWebKitDriverInstallCommand('apk');
      expect(command).toBe('sudo apk add webkit2gtk-driver');
    });

    it('should return correct install command for xbps (Void)', () => {
      const command = getWebKitDriverInstallCommand('xbps');
      expect(command).toBe('sudo xbps-install -y webkit2gtk-driver');
    });

    it('should default to apt for unknown package managers', () => {
      const command = getWebKitDriverInstallCommand('unknown');
      expect(command).toBe('sudo apt-get install -y webkit2gtk-driver');
    });
  });

  describe('ensureWebKitWebDriver', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should return success on non-Linux platforms', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      const result = await ensureWebKitWebDriver();
      expect(result.success).toBe(true);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should return error with install instructions when WebKitWebDriver not found', async () => {
      // Skip this test on non-Linux platforms or when WebKitWebDriver is actually installed
      if (process.platform !== 'linux') {
        return;
      }

      // This test documents the expected behavior when WebKitWebDriver is missing
      // The actual implementation uses execSync and fs, which we'd need to mock
      // for a more isolated test, but this documents the API contract

      const result = await ensureWebKitWebDriver();

      // If WebKitWebDriver is not installed, we should get an error
      if (!result.success) {
        expect(result.error).toBe('WebKitWebDriver not found');
        expect(result.installInstructions).toBeDefined();
        expect(result.installInstructions).toContain('sudo');
        expect(result.installInstructions).toContain('webkit2gtk-driver');
      } else {
        // If it IS installed, we should get success with a path
        expect(result.path).toBeDefined();
        expect(result.path).toContain('WebKitWebDriver');
      }
    });
  });
});
