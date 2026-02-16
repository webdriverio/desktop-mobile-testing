import type { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TauriCapabilities } from '../../src/types.js';

// Mock process.platform to bypass macOS check in tests
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
Object.defineProperty(process, 'platform', {
  value: 'linux',
  configurable: true,
});

// Restore original platform after all tests
afterAll(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
});

// Mock driver discovery
vi.mock('../../src/driverManager.js', () => ({
  ensureTauriDriver: vi.fn(),
  ensureWebKitWebDriver: vi.fn().mockResolvedValue({
    ok: true,
    value: { path: '/usr/bin/WebKitWebDriver' },
  }),
}));

vi.mock('../../src/pathResolver.js', () => ({
  getTauriAppInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }),
  getTauriBinaryPath: vi.fn().mockResolvedValue('/app/my-app'),
  getWebKitWebDriverPath: vi.fn().mockReturnValue('/usr/bin/WebKitWebDriver'),
}));

vi.mock('@wdio/native-utils', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  })),
  isErr: vi.fn(() => false),
  isOk: vi.fn(() => true),
  Ok: vi.fn((v: unknown) => ({ ok: true, value: v })),
  Err: vi.fn((e: unknown) => ({ ok: false, error: e })),
}));

vi.mock('../../src/edgeDriverManager.js', () => ({
  ensureMsEdgeDriver: vi.fn().mockResolvedValue({
    ok: true,
    value: {
      method: 'found',
      driverVersion: '120.0.0',
    },
  }),
}));

// Mock fs.existsSync to always return true for app binaries
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
  };
});

// Mock execSync to prevent ldd errors in tests
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

import { ensureTauriDriver } from '../../src/driverManager.js';
import TauriLaunchService from '../../src/launcher.js';
import { mockSuccessPath } from '../mockPaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track all spawned processes for cleanup
const spawnedProcesses: ReturnType<typeof spawn>[] = [];

// Global cleanup
afterAll(async () => {
  for (const proc of spawnedProcesses) {
    if (!proc.killed) {
      proc.kill('SIGKILL');
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
});

describe('Multiremote Mode - Integration', () => {
  let launcher: TauriLaunchService;

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (launcher) {
      try {
        await Promise.race([
          (launcher as any).onComplete?.(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 10000)),
        ]);
      } catch {
        // Ignore cleanup errors
      }
    }
    // Wait for ports to be fully released
    await new Promise((resolve) => setTimeout(resolve, 200));
  });

  describe('instance spawning', () => {
    it('should spawn separate driver per multiremote instance', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 }, // Multiremote doesn't need maxInstances > 1
      );

      // Multiremote capabilities structure
      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
        browserB: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
      };

      // Simulate onPrepare (this spawns drivers for multiremote)
      await (launcher as any).onPrepare({}, capabilities);

      // Verify at least one driver is running
      expect((launcher as any).getTauriDriverStatus().running).toBe(true);
    });

    it('should allocate unique ports for each instance', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        } as { capabilities: TauriCapabilities; port?: number },
        browserB: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        } as { capabilities: TauriCapabilities; port?: number },
      };

      await (launcher as any).onPrepare({}, capabilities);

      // Verify ports are unique (set on the entry object, not inside capabilities)
      const portA = capabilities.browserA.port;
      const portB = capabilities.browserB.port;

      expect(portA).toBeDefined();
      expect(portB).toBeDefined();
      expect(portA).not.toBe(portB);
      expect(portA).toBeGreaterThan(0);
      expect(portB).toBeGreaterThan(0);
    });

    it('should update capabilities with correct ports and hostname', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        } as { capabilities: TauriCapabilities; port?: number; hostname?: string },
      };

      await (launcher as any).onPrepare({}, capabilities);

      // Verify port and hostname are set on the entry object
      expect(capabilities.browserA.port).toBeDefined();
      expect(capabilities.browserA.hostname).toBe('127.0.0.1');
    });
  });

  describe('instance isolation', () => {
    it('should stop correct instance without affecting others', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
        browserB: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
      };

      await (launcher as any).onPrepare({}, capabilities);

      // Stop one instance
      await (launcher as any).stopTauriDriverForInstance?.('browserA');

      // Other instance should still be running
      expect((launcher as any).getTauriDriverStatus().running).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should handle instance-specific data directories', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
            'wdio:tauriServiceOptions': {
              env: { XDG_DATA_HOME: '/tmp/browserA-data' },
            },
          } as TauriCapabilities,
        },
        browserB: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
            'wdio:tauriServiceOptions': {
              env: { XDG_DATA_HOME: '/tmp/browserB-data' },
            },
          } as TauriCapabilities,
        },
      };

      // Should not throw when starting with different data directories
      await expect((launcher as any).onPrepare({}, capabilities)).resolves.not.toThrow();
    });

    it('should cleanup all instances in onComplete', async () => {
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: mockSuccessPath, method: 'found' },
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
        browserB: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
      };

      await (launcher as any).onPrepare({}, capabilities);

      // onComplete should clean up all instances without errors
      await expect((launcher as any).onComplete?.()).resolves.not.toThrow();
    });

    it('should handle instance start failures gracefully', async () => {
      // Use a driver that will fail to start
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        ok: true,
        value: { path: 'node', method: 'found' }, // This will exit immediately
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      const capabilities = {
        browserA: {
          capabilities: {
            browserName: 'tauri',
            'tauri:options': { application: '/app' },
          } as TauriCapabilities,
        },
      };

      // Should reject when driver fails to start
      await expect((launcher as any).onPrepare({}, capabilities)).rejects.toThrow();
    });
  });
});
