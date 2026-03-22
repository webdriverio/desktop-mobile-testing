import assert from 'node:assert';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeDriverResult } from '../src/edgeDriverManager.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, stdout: string, stderr: string) => {
          if (err) reject(err);
          else resolve({ stdout, stderr });
        });
      }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  chmodSync: vi.fn(),
}));

describe('Edge Driver Manager', () => {
  let detectEdgeVersion: () => Promise<string | undefined>;
  let detectWebView2Version: () => Promise<string | undefined>;
  let getMajorVersion: (version: string) => string;
  let findMsEdgeDriver: () => Promise<{ path?: string; version?: string }>;
  let ensureMsEdgeDriver: (tauriBinaryPath?: string, autoDownload?: boolean) => Promise<EdgeDriverResult>;
  let downloadMsEdgeDriver: (edgeVersion: string) => Promise<string>;

  const originalPlatform = process.platform;

  beforeEach(async () => {
    const module = await import('../src/edgeDriverManager.js');
    detectEdgeVersion = module.detectEdgeVersion;
    detectWebView2Version = module.detectWebView2Version;
    getMajorVersion = module.getMajorVersion;
    findMsEdgeDriver = module.findMsEdgeDriver;
    ensureMsEdgeDriver = module.ensureMsEdgeDriver;
    downloadMsEdgeDriver = module.downloadMsEdgeDriver;

    vi.clearAllMocks();

    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  describe('getMajorVersion', () => {
    it('should extract major version from full version string', () => {
      expect(getMajorVersion('143.0.3650.139')).toBe('143');
      expect(getMajorVersion('144.0.0.0')).toBe('144');
      expect(getMajorVersion('120.1.2345.67')).toBe('120');
    });

    it('should handle version with only major', () => {
      expect(getMajorVersion('143')).toBe('143');
    });
  });

  describe('detectEdgeVersion', () => {
    it('should return undefined on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });

      const version = await detectEdgeVersion();
      expect(version).toBeUndefined();
    });

    it('should detect Edge version from registry on Windows', async () => {
      const { exec } = await import('node:child_process');

      vi.mocked(exec as any).mockImplementation(((cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        if (cmd.includes('reg query') && cmd.includes('56EB18F8')) {
          callback?.(null, '    pv    REG_SZ    143.0.3650.139\n', '');
        } else {
          callback?.(new Error('Not found'), '', '');
        }
        return {} as any;
      }) as any);

      const version = await detectEdgeVersion();
      expect(version).toBe('143.0.3650.139');
    });

    it('should fall back to wmic when registry queries fail', async () => {
      const { exec } = await import('node:child_process');

      vi.mocked(exec as any).mockImplementation(((cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        if (cmd.includes('wmic')) {
          callback?.(null, 'Version=143.0.3650.139\n', '');
        } else {
          callback?.(new Error('Not found'), '', '');
        }
        return {} as any;
      }) as any);

      const version = await detectEdgeVersion();
      expect(version).toBe('143.0.3650.139');
    });

    it('should return undefined when all detection methods fail', async () => {
      const { exec } = await import('node:child_process');

      vi.mocked(exec as any).mockImplementation(((_cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        callback?.(new Error('Not found'), '', '');
        return {} as any;
      }) as any);

      const version = await detectEdgeVersion();
      expect(version).toBeUndefined();
    });
  });

  describe('detectWebView2Version', () => {
    it('should return undefined on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });

      const version = await detectWebView2Version();
      expect(version).toBeUndefined();
    });
  });

  describe('findMsEdgeDriver', () => {
    it('should return empty object on non-Windows', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true,
      });

      const result = await findMsEdgeDriver();
      expect(result).toEqual({});
    });
  });

  describe('ensureMsEdgeDriver', () => {
    it('should skip on non-Windows platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true,
      });

      const result = await ensureMsEdgeDriver();
      assert(result.ok);
      expect(result.value.method).toBe('skipped');
    });

    it('should handle Edge version detection failure gracefully', async () => {
      const { exec } = await import('node:child_process');

      vi.mocked(exec as any).mockImplementation(((_cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        callback?.(new Error('Registry error'), '', '');
        return {} as any;
      }) as any);

      const result = await ensureMsEdgeDriver();
      assert(result.ok);
      expect(result.value.method).toBe('skipped');
    });

    it('should return found when driver version matches Edge version', async () => {
      const { exec } = await import('node:child_process');
      const { existsSync } = await import('node:fs');

      vi.mocked(exec as any).mockImplementation(((cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        if (cmd.includes('reg query') && cmd.includes('F3017226')) {
          callback?.(null, '    pv    REG_SZ    143.0.3650.139\n', '');
        } else if (cmd.includes('where msedgedriver')) {
          callback?.(null, 'C:\\driver\\msedgedriver.exe\n', '');
        } else if (cmd.includes('--version')) {
          callback?.(null, 'MSEdgeDriver 143.0.3650.140\n', '');
        } else {
          callback?.(new Error('Not found'), '', '');
        }
        return {} as any;
      }) as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await ensureMsEdgeDriver();
      assert(result.ok);
      expect(result.value.method).toBe('found');
      expect(result.value.driverVersion).toBe('143.0.3650.140');
      expect(result.value.edgeVersion).toBe('143.0.3650.139');
    });

    it('should return error when version mismatch and autoDownload is false', async () => {
      const { exec } = await import('node:child_process');
      const { existsSync } = await import('node:fs');

      vi.mocked(exec as any).mockImplementation(((cmd: string, _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        if (cmd.includes('reg query') && cmd.includes('F3017226')) {
          callback?.(null, '    pv    REG_SZ    143.0.3650.139\n', '');
        } else if (cmd.includes('where msedgedriver')) {
          callback?.(null, 'C:\\driver\\msedgedriver.exe\n', '');
        } else if (cmd.includes('--version')) {
          callback?.(null, 'MSEdgeDriver 120.0.1000.0\n', '');
        } else {
          callback?.(new Error('Not found'), '', '');
        }
        return {} as any;
      }) as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await ensureMsEdgeDriver(undefined, false);
      assert(!result.ok);
      expect(result.error.message).toContain('version mismatch');
    });
  });

  describe('downloadMsEdgeDriver', () => {
    it('should succeed when PowerShell download completes', async () => {
      const { execFile } = await import('node:child_process');
      const { existsSync } = await import('node:fs');

      vi.mocked(execFile as any).mockImplementation(((_cmd: string, _args: string[], _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        callback?.(null, 'SUCCESS: downloaded', '');
        return {} as any;
      }) as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await downloadMsEdgeDriver('143.0.3650.139');
      expect(result).toContain('msedgedriver.exe');
    });

    it('should throw when download fails', async () => {
      const { execFile } = await import('node:child_process');
      const { existsSync } = await import('node:fs');

      vi.mocked(execFile as any).mockImplementation(((_cmd: string, _args: string[], _opts: any, callback: any) => {
        if (typeof _opts === 'function') {
          callback = _opts;
        }
        callback?.(new Error('PowerShell error'), '', 'Download failed');
        return {} as any;
      }) as any);

      vi.mocked(existsSync).mockReturnValue(false);

      await expect(downloadMsEdgeDriver('143.0.3650.139')).rejects.toThrow('Failed to download msedgedriver');
    });
  });
});
