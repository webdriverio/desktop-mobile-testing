import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn((cmd: string) => {
    if (cmd.includes('dpkg')) {
      return '';
    }
    if (cmd.includes('ldd')) {
      return 'libfoo.so => /usr/lib/libfoo.so\nlibbar.so => not found';
    }
    if (cmd.includes('df -h')) {
      return 'Filesystem Size Used Avail\n/dev/sda1 100G 50G 50G';
    }
    return '';
  }),
}));

vi.mock('node:child_process', () => ({
  default: {
    execSync: mockExecSync,
  },
  execSync: mockExecSync,
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      statSync: vi.fn(() => ({
        size: 100 * 1024 * 1024,
        mode: 0o755,
      })),
    },
    statSync: vi.fn(() => ({
      size: 100 * 1024 * 1024,
      mode: 0o755,
    })),
  };
});

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  diagnoseBinary: vi.fn(() => [
    { category: 'Binary Permissions', status: 'ok', message: '755' },
    { category: 'Binary Size', status: 'ok', message: '100.00 MB' },
  ]),
  diagnoseDiskSpace: vi.fn(() => [{ category: 'Disk Space', status: 'ok', message: '50G used, 50G available' }]),
  diagnoseDisplay: vi.fn(() => []),
  diagnoseLinuxDependencies: vi.fn(() => []),
  diagnosePlatform: vi.fn(() => [
    { category: 'Platform', status: 'ok', message: 'darwin x64' },
    { category: 'Node Version', status: 'ok', message: 'v20.0.0' },
  ]),
  diagnoseSharedLibraries: vi.fn(() => []),
  formatDiagnosticResults: vi.fn(),
}));

import { type DiagnosticResult, formatDiagnosticResults } from '@wdio/native-utils';
import { diagnoseElectronEnvironment } from '../src/diagnostics.js';

describe('diagnoseElectronEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DISPLAY;
  });

  it('should return platform diagnostics', async () => {
    const results = await diagnoseElectronEnvironment();
    const platform = results.find((r) => r.category === 'Platform');
    expect(platform?.status).toBe('ok');
    expect(platform?.message).toMatch(/(darwin|linux|win32)/);
  });

  it('should return node version diagnostics', async () => {
    const results = await diagnoseElectronEnvironment();
    const nodeVersion = results.find((r) => r.category === 'Node Version');
    expect(nodeVersion?.status).toBe('ok');
    expect(nodeVersion?.message).toMatch(/^v\d+/);
  });

  it('should diagnose binary when path provided', async () => {
    const results = await diagnoseElectronEnvironment({
      appBinaryPath: '/path/to/app',
    });
    const binaryPerms = results.find((r) => r.category === 'Binary Permissions');
    expect(binaryPerms).toBeDefined();
    expect(binaryPerms?.status).toBe('ok');
  });

  it('should diagnose Electron version', async () => {
    const results = await diagnoseElectronEnvironment({
      electronVersion: '28.0.0',
    });
    const version = results.find((r) => r.category === 'Electron Version');
    expect(version?.status).toBe('ok');
    expect(version?.message).toBe('v28.0.0');
  });

  it('should warn on Electron version < 26', async () => {
    const results = await diagnoseElectronEnvironment({
      electronVersion: '25.0.0',
    });
    const version = results.find((r) => r.category === 'Electron Version');
    expect(version?.status).toBe('error');
    expect(version?.message).toContain('26+');
  });

  it('should warn on unparseable version', async () => {
    const results = await diagnoseElectronEnvironment({
      electronVersion: 'invalid',
    });
    const version = results.find((r) => r.category === 'Electron Version');
    expect(version?.status).toBe('warn');
  });

  it('should diagnose Chromium version', async () => {
    const results = await diagnoseElectronEnvironment({
      chromiumVersion: '120.0.0',
    });
    const version = results.find((r) => r.category === 'Chromium Version');
    expect(version?.status).toBe('ok');
    expect(version?.message).toBe('v120.0.0');
  });

  it('should include disk space diagnostics', async () => {
    const results = await diagnoseElectronEnvironment();
    const disk = results.find((r) => r.category === 'Disk Space');
    expect(disk).toBeDefined();
  });
});

describe('formatDiagnosticResults', () => {
  it('should format results without throwing', () => {
    const results: DiagnosticResult[] = [
      { category: 'Test', status: 'ok', message: 'All good' },
      { category: 'Warning', status: 'warn', message: 'Something might be wrong', details: 'More info' },
      { category: 'Error', status: 'error', message: 'Something is broken' },
    ];
    expect(() => formatDiagnosticResults(results)).not.toThrow();
  });
});
