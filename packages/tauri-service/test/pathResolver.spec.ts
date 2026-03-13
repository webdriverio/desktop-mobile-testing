import { chmodSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTauriAppInfo, getTauriBinaryPath, getWebKitWebDriverPath, isTauriAppBuilt } from '../src/pathResolver.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('pathResolver', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTauriAppInfo', () => {
    it('should throw when tauri.conf.json does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await expect(getTauriAppInfo('/app')).rejects.toThrow(
        `Tauri config not found: ${join('/app', 'src-tauri', 'tauri.conf.json')}`,
      );
    });

    it('should parse Tauri v2 config with productName and version at root', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          productName: 'my-tauri-app',
          version: '2.0.0',
        }),
      );

      const info = await getTauriAppInfo('/app');

      expect(info.name).toBe('my-tauri-app');
      expect(info.version).toBe('2.0.0');
      expect(info.targetDir).toBe(join('/app', 'src-tauri', 'target', 'debug'));
      expect(info.configPath).toBe(join('/app', 'src-tauri', 'tauri.conf.json'));
      expect(info.binaryPath).toBe('');
    });

    it('should fall back to package.productName for Tauri v1 config', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({
          package: {
            productName: 'v1-app',
            version: '1.5.0',
          },
        }),
      );

      const info = await getTauriAppInfo('/app');

      expect(info.name).toBe('v1-app');
      expect(info.version).toBe('1.5.0');
    });

    it('should use defaults when properties are missing', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));

      const info = await getTauriAppInfo('/app');

      expect(info.name).toBe('tauri-app');
      expect(info.version).toBe('1.0.0');
    });
  });

  describe('getTauriBinaryPath', () => {
    function mockTauriConfig(name: string) {
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ productName: name, version: '1.0.0' }));
    }

    it('should resolve binary on win32 finding .exe', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p.endsWith('MyApp.exe')) return true;
        return false;
      });

      const result = await getTauriBinaryPath('/app', 'win32');

      expect(result).toBe(join('/app', 'src-tauri', 'target', 'debug', 'MyApp.exe'));
    });

    it('should resolve binary on darwin finding raw binary', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === join('/app', 'src-tauri', 'target', 'debug', 'MyApp')) return true;
        return false;
      });

      const result = await getTauriBinaryPath('/app', 'darwin');

      expect(result).toBe(join('/app', 'src-tauri', 'target', 'debug', 'MyApp'));
      expect(chmodSync).toHaveBeenCalledWith(result, 0o755);
    });

    it('should resolve binary on darwin finding .app bundle', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p.endsWith('MyApp.app')) return true;
        return false;
      });

      const result = await getTauriBinaryPath('/app', 'darwin');

      expect(result).toBe(join('/app', 'src-tauri', 'target', 'debug', 'bundle', 'macos', 'MyApp.app'));
    });

    it('should resolve binary on linux finding lowercase name', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === join('/app', 'src-tauri', 'target', 'debug', 'myapp')) return true;
        return false;
      });

      const result = await getTauriBinaryPath('/app', 'linux');

      expect(result).toBe(join('/app', 'src-tauri', 'target', 'debug', 'myapp'));
      expect(chmodSync).toHaveBeenCalledWith(result, 0o755);
    });

    it('should resolve binary on linux finding original name', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === join('/app', 'src-tauri', 'target', 'debug', 'MyApp')) return true;
        return false;
      });

      const result = await getTauriBinaryPath('/app', 'linux');

      expect(result).toBe(join('/app', 'src-tauri', 'target', 'debug', 'MyApp'));
    });

    it('should throw for unsupported platform', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString().endsWith('tauri.conf.json');
      });

      await expect(getTauriBinaryPath('/app', 'freebsd' as NodeJS.Platform)).rejects.toThrow(
        'Unsupported platform for Tauri: freebsd',
      );
    });

    it('should throw when binary not found', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString().endsWith('tauri.conf.json');
      });

      await expect(getTauriBinaryPath('/app', 'darwin')).rejects.toThrow('Tauri binary not found');
    });

    it('should handle binary path input by extracting app dir from target/release path', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === join('/project', 'src-tauri', 'target', 'debug', 'MyApp')) return true;
        return false;
      });

      const binaryInputPath = join('/project', 'src-tauri', 'target', 'release', 'MyApp');
      const result = await getTauriBinaryPath(binaryInputPath, 'darwin');

      expect(result).toBe(join('/project', 'src-tauri', 'target', 'debug', 'MyApp'));
    });

    it('should not call chmodSync on win32', async () => {
      mockTauriConfig('MyApp');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p.endsWith('MyApp.exe')) return true;
        return false;
      });

      await getTauriBinaryPath('/app', 'win32');

      expect(chmodSync).not.toHaveBeenCalled();
    });

    it('should check NSIS bundle directory on win32', async () => {
      mockTauriConfig('MyApp');
      const nsisDir = join('/app', 'src-tauri', 'target', 'debug', 'bundle', 'nsis');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === nsisDir) return true;
        if (p === join(nsisDir, 'MyApp.exe')) return true;
        return false;
      });
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path.toString() === nsisDir) {
          return ['MyApp.exe', 'MyApp-setup.exe'] as unknown as ReturnType<typeof readdirSync>;
        }
        return [] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = await getTauriBinaryPath('/app', 'win32');

      expect(result).toBe(join(nsisDir, 'MyApp.exe'));
    });

    it('should check AppImage bundle directory on linux', async () => {
      mockTauriConfig('MyApp');
      const bundleDir = join('/app', 'src-tauri', 'target', 'debug', 'bundle', 'appimage');
      vi.mocked(existsSync).mockImplementation((path) => {
        const p = path.toString();
        if (p.endsWith('tauri.conf.json')) return true;
        if (p === bundleDir) return true;
        if (p === join(bundleDir, 'myapp_1.0.0_amd64.AppImage')) return true;
        return false;
      });
      vi.mocked(readdirSync).mockImplementation((path) => {
        if (path.toString() === bundleDir) {
          return ['myapp_1.0.0_amd64.AppImage'] as unknown as ReturnType<typeof readdirSync>;
        }
        return [] as unknown as ReturnType<typeof readdirSync>;
      });

      const result = await getTauriBinaryPath('/app', 'linux');

      expect(result).toBe(join(bundleDir, 'myapp_1.0.0_amd64.AppImage'));
    });
  });

  describe('isTauriAppBuilt', () => {
    it('should return true when binary exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ productName: 'MyApp', version: '1.0.0' }));
      vi.mocked(readdirSync).mockReturnValue([] as unknown as ReturnType<typeof readdirSync>);

      const result = await isTauriAppBuilt('/app');

      expect(result).toBe(true);
    });

    it('should return false when binary does not exist', async () => {
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString().endsWith('tauri.conf.json');
      });
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ productName: 'MyApp', version: '1.0.0' }));

      const result = await isTauriAppBuilt('/app');

      expect(result).toBe(false);
    });

    it('should return false when config does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await isTauriAppBuilt('/app');

      expect(result).toBe(false);
    });
  });

  describe('getWebKitWebDriverPath', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return undefined on non-Linux platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      expect(getWebKitWebDriverPath()).toBeUndefined();
    });

    it('should find WebKitWebDriver in PATH on linux', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { execSync } = await import('node:child_process');
      vi.mocked(execSync).mockReturnValue('/usr/bin/WebKitWebDriver\n');
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString() === '/usr/bin/WebKitWebDriver';
      });

      expect(getWebKitWebDriverPath()).toBe('/usr/bin/WebKitWebDriver');
    });

    it('should check fallback paths on linux when not in PATH', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { execSync } = await import('node:child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockImplementation((path) => {
        return path.toString() === '/usr/lib/webkit2gtk-4.1/WebKitWebDriver';
      });

      expect(getWebKitWebDriverPath()).toBe('/usr/lib/webkit2gtk-4.1/WebKitWebDriver');
    });

    it('should return undefined on linux when WebKitWebDriver is not found anywhere', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const { execSync } = await import('node:child_process');
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('not found');
      });
      vi.mocked(existsSync).mockReturnValue(false);

      expect(getWebKitWebDriverPath()).toBeUndefined();
    });
  });
});
