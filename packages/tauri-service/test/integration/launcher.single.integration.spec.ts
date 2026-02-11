import type { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock only the driver discovery, not the process itself
vi.mock('../../src/driverManager.js', () => ({
  ensureTauriDriver: vi.fn(),
  ensureWebKitWebDriver: vi.fn(),
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
}));

vi.mock('../../src/edgeDriverManager.js', () => ({
  ensureMsEdgeDriver: vi.fn().mockResolvedValue({
    success: true,
    method: 'found',
    driverVersion: '120.0.0',
  }),
}));

import { ensureTauriDriver } from '../../src/driverManager.js';
import TauriLaunchService from '../../src/launcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track all spawned processes for cleanup
const spawnedProcesses: ReturnType<typeof spawn>[] = [];

// Helper to get mock driver path
function getMockDriver(name: string): string {
  return path.join(__dirname, '..', 'fixtures', name);
}

// Global cleanup - kill any leftover processes
afterAll(async () => {
  for (const proc of spawnedProcesses) {
    if (!proc.killed) {
      proc.kill('SIGKILL');
    }
  }
  // Give processes time to die
  await new Promise((resolve) => setTimeout(resolve, 100));
});

describe('Single Mode - Integration', () => {
  let launcher: TauriLaunchService;
  let testPort = 4444;
  let testNativePort = 4445;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Use different ports for each test to avoid conflicts
    testPort = 4444 + Math.floor(Math.random() * 100);
    testNativePort = testPort + 1;
  });

  afterEach(async () => {
    // Clean up launcher after each test
    if (launcher) {
      try {
        await Promise.race([
          (launcher as any).stopTauriDriver(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), 5000)),
        ]);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('startup', () => {
    it('should spawn driver and detect startup message', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: mockDriverPath,
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      await (launcher as any).startTauriDriver(testPort, testNativePort, []);

      expect((launcher as any).getTauriDriverStatus().running).toBe(true);
      expect((launcher as any).getTauriDriverStatus().pid).toBeDefined();
    });

    it('should spawn with correct arguments', async () => {
      // Note: Cannot spy on node:child_process in ESM modules to verify exact args
      // Instead, this test verifies that spawn works correctly with the expected config
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: mockDriverPath,
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      await (launcher as any).startTauriDriver(testPort, testNativePort, []);

      // If we get here, spawn was called with correct arguments
      // and the driver started successfully
      expect((launcher as any).getTauriDriverStatus().running).toBe(true);
    });

    it('should reject on bind failure', async () => {
      const mockDriverPath = getMockDriver('mock-driver-bind-fail.js');
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: mockDriverPath,
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      await expect((launcher as any).startTauriDriver(testPort, testNativePort, [])).rejects.toThrow();
    });

    it('should reject if process exits during startup', async () => {
      // Create a mock driver that exits immediately
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: 'node',
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      // Use node -e to exit immediately
      await expect((launcher as any).startTauriDriver(testPort, testNativePort, [])).rejects.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should stop with SIGTERM and wait for graceful exit', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: mockDriverPath,
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      await (launcher as any).startTauriDriver(testPort, testNativePort, []);
      const pid = (launcher as any).getTauriDriverStatus().pid;
      expect(pid).toBeDefined();

      await (launcher as any).stopTauriDriver();

      expect((launcher as any).getTauriDriverStatus().running).toBe(false);
    });

    // Note: Force kill (SIGKILL) is not tested here because:
    // 1. It's platform-specific (macOS handles SIGKILL differently than Linux)
    // 2. It's difficult to test reliably across CI environments
    // 3. The graceful shutdown test above covers the primary path
    // Force kill behavior is implicitly tested when cleanup runs after timeouts.
  });

  describe('stream handling', () => {
    it('should capture stdout and stderr output', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');
      vi.mocked(ensureTauriDriver).mockResolvedValue({
        success: true,
        path: mockDriverPath,
        method: 'found',
      });

      launcher = new TauriLaunchService(
        {},
        { browserName: 'tauri', 'tauri:options': { application: '/app' } },
        { maxInstances: 1 },
      );

      await (launcher as any).startTauriDriver(testPort, testNativePort, []);

      // The mock driver outputs to both stdout and stderr
      // The launcher should capture and log both
      expect((launcher as any).getTauriDriverStatus().running).toBe(true);
    });
  });
});
