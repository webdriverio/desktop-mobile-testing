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

    it('should have proper result structure for WebKitWebDriver', async () => {
      // Skip this test on non-Linux platforms
      if (process.platform !== 'linux') {
        return;
      }

      const result = await ensureWebKitWebDriver();

      // Check the result structure regardless of success/failure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('installInstructions');
    });

    it('should return valid result for WebKitWebDriver check', async () => {
      // Skip this test on non-Linux platforms
      if (process.platform !== 'linux') {
        return;
      }

      const result = await ensureWebKitWebDriver();

      // Always check that we get a properly structured result
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('error');
      expect(result).toHaveProperty('installInstructions');

      // The result should be consistent - if success is true, we should have a path and no error
      // If success is false, we should have an error and install instructions
      const hasPath = result.path && result.path.length > 0;
      const hasError = result.error && result.error.length > 0;
      const hasInstallInstructions = result.installInstructions && result.installInstructions.length > 0;

      expect(result.success ? hasPath : hasError).toBe(true);
      expect(result.success ? !hasError : hasInstallInstructions).toBe(true);
    });
  });
});
