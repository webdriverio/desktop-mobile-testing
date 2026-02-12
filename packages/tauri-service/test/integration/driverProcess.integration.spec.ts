import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DriverProcess } from '../../src/driverProcess.js';
import type { TauriServiceOptions } from '../../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Track all DriverProcess instances for cleanup
const driverProcesses: DriverProcess[] = [];

// Helper to get mock driver path
function getMockDriver(name: string): string {
  return path.join(__dirname, '..', 'fixtures', name);
}

// Global cleanup
afterAll(async () => {
  for (const driver of driverProcesses) {
    try {
      if (driver.isRunning()) {
        await driver.stop();
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}, 10000);

describe('DriverProcess - Integration', () => {
  let driver: DriverProcess;
  const testPort = 4444;
  const testNativePort = 4445;
  const baseOptions: TauriServiceOptions = {
    captureBackendLogs: false,
    captureFrontendLogs: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new DriverProcess();
    driverProcesses.push(driver);
  });

  afterEach(async () => {
    try {
      // Only stop if driver was started
      if (driver.isRunning()) {
        await driver.stop();
      }
    } catch {
      // Ignore errors during cleanup
    }
    // Remove from tracking
    const index = driverProcesses.indexOf(driver);
    if (index > -1) {
      driverProcesses.splice(index, 1);
    }
  }, 5000);

  describe('startup', () => {
    it('should start driver and detect startup message', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      const info = await driver.start({
        mode: 'single',
        identifier: 'test-driver',
        port: testPort,
        nativePort: testNativePort,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      expect(info.proc.pid).toBeDefined();
      expect(driver.isRunning()).toBe(true);
      expect(driver.port).toBe(testPort);
      expect(driver.nativePort).toBe(testNativePort);
    });

    // Note: Error path tests (bind failure, process exit, timeout) are covered in launcher tests.
    // DriverProcess error handling is implicitly tested through the launcher integration tests.
  });

  describe('shutdown', () => {
    it('should stop with SIGTERM and wait for graceful exit', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      await driver.start({
        mode: 'single',
        identifier: 'test-driver',
        port: testPort,
        nativePort: testNativePort,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      expect(driver.isRunning()).toBe(true);

      await driver.stop();

      expect(driver.isRunning()).toBe(false);
      // Note: driver.proc may still hold a reference to the dead process object
      // The important thing is isRunning() returns false
    });

    it('should be safe to call stop multiple times', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      await driver.start({
        mode: 'single',
        identifier: 'test-driver',
        port: testPort,
        nativePort: testNativePort,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      await driver.stop();
      await driver.stop(); // Should not throw
      await driver.stop(); // Should not throw

      expect(driver.isRunning()).toBe(false);
    });

    // Note: Force kill (SIGKILL) is not tested here because:
    // 1. It's platform-specific (macOS handles SIGKILL differently than Linux)
    // 2. It's tested implicitly when cleanup runs after test timeouts
  });

  describe('state management', () => {
    it('should track running state correctly', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      expect(driver.isRunning()).toBe(false);

      await driver.start({
        mode: 'single',
        identifier: 'test-driver',
        port: testPort,
        nativePort: testNativePort,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      expect(driver.isRunning()).toBe(true);

      await driver.stop();

      expect(driver.isRunning()).toBe(false);
    });

    it('should provide access to process info', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      await driver.start({
        mode: 'single',
        identifier: 'test-driver',
        port: testPort,
        nativePort: testNativePort,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      expect(driver.proc).toBeDefined();
      expect(driver.proc?.pid).toBeGreaterThan(0);
      expect(driver.port).toBe(testPort);
      expect(driver.nativePort).toBe(testNativePort);
    });
  });

  describe('multiple instances', () => {
    it('should manage multiple drivers independently', async () => {
      const mockDriverPath = getMockDriver('mock-tauri-driver.js');

      const driver2 = new DriverProcess();
      driverProcesses.push(driver2);

      // Start both drivers on different ports
      const info1 = await driver.start({
        mode: 'single',
        identifier: 'driver-1',
        port: 4444,
        nativePort: 4445,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      const info2 = await driver2.start({
        mode: 'single',
        identifier: 'driver-2',
        port: 4446,
        nativePort: 4447,
        tauriDriverPath: mockDriverPath,
        options: baseOptions,
      });

      // Both should be running
      expect(driver.isRunning()).toBe(true);
      expect(driver2.isRunning()).toBe(true);

      // Different PIDs
      expect(info1.proc.pid).not.toBe(info2.proc.pid);

      // Stop first driver
      await driver.stop();
      expect(driver.isRunning()).toBe(false);
      expect(driver2.isRunning()).toBe(true);

      // Stop second driver
      await driver2.stop();
      expect(driver2.isRunning()).toBe(false);
    });
  });
});
