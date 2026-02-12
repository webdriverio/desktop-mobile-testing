import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockIsRunning = vi.fn();

vi.mock('../src/driverManager.js', () => ({
  ensureTauriDriver: vi.fn(async () => ({
    ok: true,
    value: { path: '/mock/tauri-driver', method: 'found' as const },
  })),
}));

vi.mock('../src/driverProcess.js', () => ({
  DriverProcess: class MockDriverProcess {
    start = mockStart.mockResolvedValue({ proc: { pid: 12345 } });
    stop = mockStop.mockResolvedValue(undefined);
    isRunning = mockIsRunning.mockReturnValue(true);
    proc = { pid: 12345 };
  },
}));

vi.mock('../src/pathResolver.js', () => ({
  getWebKitWebDriverPath: vi.fn(() => '/mock/webkit-driver'),
}));

describe('DriverPool', () => {
  let pool: Awaited<ReturnType<typeof import('../src/driverPool.js').DriverPool>>;

  beforeEach(async () => {
    mockStart.mockClear().mockResolvedValue({ proc: { pid: 12345 } });
    mockStop.mockClear().mockResolvedValue(undefined);
    mockIsRunning.mockClear().mockReturnValue(true);

    const { DriverPool } = await import('../src/driverPool.js');
    pool = new DriverPool({}, '/mock/native-driver');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startDriver', () => {
    it('should start a driver in single mode', async () => {
      const config = {
        mode: 'single' as const,
        identifier: 'tauri-driver',
        port: 4444,
        nativePort: 4445,
      };

      const info = await pool.startDriver(config);

      expect(info.mode).toBe('single');
      expect(info.identifier).toBe('tauri-driver');
      expect(info.port).toBe(4444);
      expect(info.nativePort).toBe(4445);
    });

    it('should start a driver in worker mode', async () => {
      const config = {
        mode: 'worker' as const,
        identifier: 'worker-0',
        port: 4500,
        nativePort: 4501,
        instanceId: '0',
      };

      const info = await pool.startDriver(config);

      expect(info.mode).toBe('worker');
      expect(info.identifier).toBe('worker-0');
    });

    it('should start a driver in multiremote mode', async () => {
      const config = {
        mode: 'multiremote' as const,
        identifier: 'browserA',
        port: 4600,
        nativePort: 4601,
        env: { CUSTOM_VAR: 'value' },
      };

      const info = await pool.startDriver(config);

      expect(info.mode).toBe('multiremote');
      expect(info.identifier).toBe('browserA');
    });

    it('should track started drivers', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'driver-1',
        port: 4444,
        nativePort: 4445,
      });

      await pool.startDriver({
        mode: 'worker',
        identifier: 'driver-2',
        port: 4500,
        nativePort: 4501,
      });

      const status = pool.getStatus();
      expect(status.count).toBe(2);
      expect(status.identifiers).toContain('driver-1');
      expect(status.identifiers).toContain('driver-2');
    });
  });

  describe('stopDriver', () => {
    it('should stop a specific driver', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'test-driver',
        port: 4444,
        nativePort: 4445,
      });

      await pool.stopDriver('test-driver');

      const status = pool.getStatus();
      expect(status.running).toBe(false);
      expect(status.count).toBe(0);
    });

    it('should handle stopping non-existent driver', async () => {
      await expect(pool.stopDriver('non-existent')).resolves.not.toThrow();
    });

    it('should only stop the specified driver', async () => {
      await pool.startDriver({
        mode: 'worker',
        identifier: 'worker-1',
        port: 4444,
        nativePort: 4445,
      });

      await pool.startDriver({
        mode: 'worker',
        identifier: 'worker-2',
        port: 4500,
        nativePort: 4501,
      });

      await pool.stopDriver('worker-1');

      const status = pool.getStatus();
      expect(status.identifiers).toContain('worker-2');
      expect(status.identifiers).not.toContain('worker-1');
    });
  });

  describe('stopAll', () => {
    it('should stop all drivers', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'driver-1',
        port: 4444,
        nativePort: 4445,
      });

      await pool.startDriver({
        mode: 'worker',
        identifier: 'driver-2',
        port: 4500,
        nativePort: 4501,
      });

      await pool.startDriver({
        mode: 'multiremote',
        identifier: 'driver-3',
        port: 4600,
        nativePort: 4601,
      });

      await pool.stopAll();

      const status = pool.getStatus();
      expect(status.count).toBe(0);
      expect(status.identifiers).toHaveLength(0);
    });

    it('should handle empty pool', async () => {
      await expect(pool.stopAll()).resolves.not.toThrow();
    });
  });

  describe('getDriver', () => {
    it('should return driver info for existing driver', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'test-driver',
        port: 4444,
        nativePort: 4445,
      });

      const info = pool.getDriver('test-driver');

      expect(info).toBeDefined();
      expect(info?.identifier).toBe('test-driver');
      expect(info?.port).toBe(4444);
    });

    it('should return undefined for non-existent driver', () => {
      const info = pool.getDriver('non-existent');
      expect(info).toBeUndefined();
    });
  });

  describe('getDriverProcess', () => {
    it('should return driver process for existing driver', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'test-driver',
        port: 4444,
        nativePort: 4445,
      });

      const process = pool.getDriverProcess('test-driver');
      expect(process).toBeDefined();
    });

    it('should return undefined for non-existent driver', () => {
      const process = pool.getDriverProcess('non-existent');
      expect(process).toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('should return correct status for empty pool', () => {
      const status = pool.getStatus();

      expect(status.running).toBe(false);
      expect(status.count).toBe(0);
      expect(status.identifiers).toHaveLength(0);
    });

    it('should return correct status with running drivers', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'driver-1',
        port: 4444,
        nativePort: 4445,
      });

      const status = pool.getStatus();

      expect(status.running).toBe(true);
      expect(status.count).toBe(1);
      expect(status.identifiers).toContain('driver-1');
    });
  });

  describe('getRunningPids', () => {
    it('should return empty array for empty pool', () => {
      const pids = pool.getRunningPids();
      expect(pids).toHaveLength(0);
    });

    it('should return PIDs for running drivers', async () => {
      await pool.startDriver({
        mode: 'single',
        identifier: 'driver-1',
        port: 4444,
        nativePort: 4445,
      });

      const pids = pool.getRunningPids();
      expect(pids).toContain(12345);
    });
  });
});
