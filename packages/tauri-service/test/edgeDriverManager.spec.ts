import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeDriverResult } from '../src/edgeDriverManager.js';

// Mock child_process and fs modules
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  chmodSync: vi.fn(),
}));

describe('Edge Driver Manager', () => {
  let detectEdgeVersion: () => Promise<string | undefined>;
  let getMajorVersion: (version: string) => string;
  let findMsEdgeDriver: () => Promise<{ path?: string; version?: string }>;
  let ensureMsEdgeDriver: (tauriBinaryPath?: string, autoDownload?: boolean) => Promise<EdgeDriverResult>;

  beforeEach(async () => {
    // Dynamic import to ensure mocks are applied
    const module = await import('../src/edgeDriverManager.js');
    detectEdgeVersion = module.detectEdgeVersion;
    getMajorVersion = module.getMajorVersion;
    findMsEdgeDriver = module.findMsEdgeDriver;
    ensureMsEdgeDriver = module.ensureMsEdgeDriver;

    // Reset mocks
    vi.clearAllMocks();

    // Mock process.platform for Windows tests
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      const { execAsync } = await import('node:util');
      vi.mocked(execAsync).mockResolvedValueOnce({
        stdout: 'pv    REG_SZ    143.0.3650.139\n',
        stderr: '',
      } as any);

      const version = await detectEdgeVersion();
      expect(version).toBe('143.0.3650.139');
    });

    it('should return undefined if Edge not found', async () => {
      const { execAsync } = await import('node:util');
      vi.mocked(execAsync).mockRejectedValue(new Error('Registry key not found'));

      const version = await detectEdgeVersion();
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

    it('should find msedgedriver in PATH', async () => {
      const { execAsync } = await import('node:util');
      const { existsSync } = await import('node:fs');

      vi.mocked(execAsync)
        .mockResolvedValueOnce({
          stdout: 'C:\\Program Files\\msedgedriver.exe\n',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'MSEdgeDriver 143.0.3650.139\n',
          stderr: '',
        } as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await findMsEdgeDriver();
      expect(result.path).toBe('C:\\Program Files\\msedgedriver.exe');
      expect(result.version).toBe('143.0.3650.139');
    });

    it('should return empty object if not found', async () => {
      const { execAsync } = await import('node:util');
      vi.mocked(execAsync).mockRejectedValue(new Error('not found'));

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
      expect(result.success).toBe(true);
      expect(result.method).toBe('skipped');
    });

    it('should return success if versions match', async () => {
      const { execAsync } = await import('node:util');
      const { existsSync } = await import('node:fs');

      // Mock Edge version detection
      vi.mocked(execAsync)
        .mockResolvedValueOnce({
          stdout: 'pv    REG_SZ    143.0.3650.139\n',
          stderr: '',
        } as any)
        // Mock finding driver
        .mockResolvedValueOnce({
          stdout: 'C:\\msedgedriver.exe\n',
          stderr: '',
        } as any)
        // Mock driver version
        .mockResolvedValueOnce({
          stdout: 'MSEdgeDriver 143.0.0.0\n',
          stderr: '',
        } as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await ensureMsEdgeDriver();
      expect(result.success).toBe(true);
      expect(result.method).toBe('found');
      expect(result.edgeVersion).toBe('143.0.3650.139');
      expect(result.driverVersion).toBe('143.0.0.0');
    });

    it('should download driver on version mismatch if auto-download enabled', async () => {
      const { execAsync } = await import('node:util');
      const { existsSync, writeFileSync } = await import('node:fs');

      // Mock Edge version detection (143)
      vi.mocked(execAsync)
        .mockResolvedValueOnce({
          stdout: 'pv    REG_SZ    143.0.3650.139\n',
          stderr: '',
        } as any)
        // Mock finding old driver (142)
        .mockResolvedValueOnce({
          stdout: 'C:\\msedgedriver.exe\n',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'MSEdgeDriver 142.0.0.0\n',
          stderr: '',
        } as any)
        // Mock PowerShell download
        .mockResolvedValueOnce({
          stdout: 'SUCCESS: msedgedriver downloaded\n',
          stderr: '',
        } as any);

      let callCount = 0;
      vi.mocked(existsSync).mockImplementation(() => {
        callCount++;
        // First calls return true (old driver exists)
        // Last call returns true (new driver downloaded)
        return callCount <= 2 || callCount > 3;
      });

      vi.mocked(writeFileSync).mockImplementation(() => undefined);

      const result = await ensureMsEdgeDriver(undefined, true);
      expect(result.success).toBe(true);
      expect(result.method).toBe('downloaded');
    });

    it('should fail if auto-download disabled and versions mismatch', async () => {
      const { execAsync } = await import('node:util');
      const { existsSync } = await import('node:fs');

      vi.mocked(execAsync)
        .mockResolvedValueOnce({
          stdout: 'pv    REG_SZ    143.0.3650.139\n',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'C:\\msedgedriver.exe\n',
          stderr: '',
        } as any)
        .mockResolvedValueOnce({
          stdout: 'MSEdgeDriver 142.0.0.0\n',
          stderr: '',
        } as any);

      vi.mocked(existsSync).mockReturnValue(true);

      const result = await ensureMsEdgeDriver(undefined, false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('version mismatch');
      expect(result.error).toContain('autoDownloadEdgeDriver: true');
    });

    it('should handle Edge version detection failure gracefully', async () => {
      const { execAsync } = await import('node:util');
      vi.mocked(execAsync).mockRejectedValue(new Error('Registry error'));

      const result = await ensureMsEdgeDriver();
      expect(result.success).toBe(true); // Don't fail hard
      expect(result.method).toBe('skipped');
      expect(result.error).toContain('Could not detect Edge version');
    });
  });
});
