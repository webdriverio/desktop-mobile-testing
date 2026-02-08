import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeDriverResult } from '../src/edgeDriverManager.js';

// Mock child_process, fs, and util modules
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
  execFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  chmodSync: vi.fn(),
}));

vi.mock('node:util', () => ({
  promisify: vi.fn((fn) => fn),
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
      expect(result.success).toBe(true);
      expect(result.method).toBe('skipped');
    });

    it('should handle Edge version detection failure gracefully', async () => {
      // Use the mocked functions directly
      const { exec } = await vi.importMock('node:child_process');

      vi.mocked(exec).mockImplementation(((_cmd: string, _opts: any, callback: any) => {
        callback?.(new Error('Registry error'), { stdout: '', stderr: '' });
        return {} as any;
      }) as any);

      const result = await ensureMsEdgeDriver();
      expect(result.success).toBe(true); // Don't fail hard
      expect(result.method).toBe('skipped');
      expect(result.error).toContain('Could not detect Edge');
    });
  });
});
