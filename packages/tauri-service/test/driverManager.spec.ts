import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureWebKitWebDriver, getWebKitDriverInstallCommand } from '../src/driverManager.js';
import { isOk } from '../src/utils/result.js';

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
      expect(isOk(result)).toBe(true);

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should have proper result structure for WebKitWebDriver', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const result = await ensureWebKitWebDriver();

      expect(result).toHaveProperty('ok');
      expect(result.ok ? result.value : result.error).toBeDefined();
      expect(result.ok ? undefined : result.error).toHaveProperty('message');
    });

    it('should return valid result for WebKitWebDriver check', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const result = await ensureWebKitWebDriver();

      expect(result).toHaveProperty('ok');
      expect(result.ok ? result.value.path : result.error.message).toBeDefined();
    });
  });
});
