import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startTestRunnerBackend, stopTestRunnerBackend } from '../src/crabnebulaBackend.js';
import * as driverManager from '../src/driverManager.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock driverManager
vi.mock('../src/driverManager.js', () => ({
  findTestRunnerBackend: vi.fn(),
}));

describe('CrabNebula Backend', () => {
  let mockProc: EventEmitter & Partial<ChildProcess>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockProc = new EventEmitter() as EventEmitter & Partial<ChildProcess>;
    // Use Object.defineProperty for read-only 'killed' property
    Object.defineProperty(mockProc, 'killed', {
      value: false,
      writable: true,
      configurable: true,
    });
    mockProc.kill = vi.fn().mockImplementation(() => {
      Object.defineProperty(mockProc, 'killed', { value: true, writable: true, configurable: true });
      return true;
    });
    // Create mock streams that support readline
    mockProc.stdout = Object.assign(new EventEmitter(), {
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      [Symbol.asyncIterator]: undefined,
    }) as unknown as ChildProcess['stdout'];
    mockProc.stderr = Object.assign(new EventEmitter(), {
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
      [Symbol.asyncIterator]: undefined,
    }) as unknown as ChildProcess['stderr'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CN_API_KEY;
  });

  describe('startTestRunnerBackend', () => {
    it('should throw when test-runner-backend is not found', async () => {
      vi.mocked(driverManager.findTestRunnerBackend).mockReturnValue(undefined);

      await expect(startTestRunnerBackend({ port: 3000 })).rejects.toThrow('test-runner-backend not found');
    });

    it('should throw when CN_API_KEY is not set', async () => {
      vi.mocked(driverManager.findTestRunnerBackend).mockReturnValue('/mock/backend');
      delete process.env.CN_API_KEY;

      await expect(startTestRunnerBackend({ port: 3000 })).rejects.toThrow('CN_API_KEY');
    });

    it('should start backend with correct environment', async () => {
      vi.mocked(driverManager.findTestRunnerBackend).mockReturnValue('/mock/backend');
      process.env.CN_API_KEY = 'test-api-key';
      vi.mocked(spawn).mockReturnValue(mockProc as ChildProcess);

      // Start the backend
      const promise = startTestRunnerBackend({ port: 3000 });

      // Simulate successful startup immediately (synchronously)
      setImmediate(() => {
        mockProc.stdout?.emit('data', 'Server listening on port 3000\n');
      });

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        '/mock/backend',
        ['--port', '3000'],
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe'],
          env: expect.objectContaining({
            CN_API_KEY: 'test-api-key',
            PORT: '3000',
          }),
        }),
      );
      expect(result.proc).toBe(mockProc);
      expect(result.port).toBe(3000);
    }, 10000);

    it('should resolve on timeout even without ready message', async () => {
      vi.mocked(driverManager.findTestRunnerBackend).mockReturnValue('/mock/backend');
      process.env.CN_API_KEY = 'test-api-key';
      vi.mocked(spawn).mockReturnValue(mockProc as ChildProcess);

      vi.useFakeTimers();

      const promise = startTestRunnerBackend({ port: 3000 });

      // Fast-forward past timeout
      vi.advanceTimersByTime(15000);

      const result = await promise;

      expect(result.proc).toBe(mockProc);
      expect(result.port).toBe(3000);

      vi.useRealTimers();
    });

    it('should reject if process exits with error', async () => {
      vi.mocked(driverManager.findTestRunnerBackend).mockReturnValue('/mock/backend');
      process.env.CN_API_KEY = 'test-api-key';
      vi.mocked(spawn).mockReturnValue(mockProc as ChildProcess);

      const promise = startTestRunnerBackend({ port: 3000 });

      // Simulate process exit
      setTimeout(() => {
        mockProc.emit('exit', 1);
      }, 10);

      await expect(promise).rejects.toThrow('exited with code 1');
    });
  });

  describe('stopTestRunnerBackend', () => {
    it('should return early if process already killed', async () => {
      Object.defineProperty(mockProc, 'killed', { value: true, writable: true, configurable: true });

      await stopTestRunnerBackend(mockProc as ChildProcess);

      expect(mockProc.kill).not.toHaveBeenCalled();
    });

    it('should send SIGTERM for graceful shutdown', async () => {
      const stopPromise = stopTestRunnerBackend(mockProc as ChildProcess);

      // Simulate process exit
      setTimeout(() => {
        mockProc.emit('exit', 0);
      }, 10);

      await stopPromise;

      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should send SIGKILL if process does not exit gracefully', async () => {
      vi.useFakeTimers();

      // Track kill calls
      const killCalls: string[] = [];
      mockProc.kill = vi.fn((signal: string) => {
        killCalls.push(signal);
        return true;
      }) as any;

      const stopPromise = stopTestRunnerBackend(mockProc as ChildProcess);

      // Fast-forward past graceful timeout
      vi.advanceTimersByTime(6000);

      await stopPromise;

      // Verify both signals were sent in order
      expect(killCalls).toContain('SIGTERM');
      expect(killCalls).toContain('SIGKILL');

      vi.useRealTimers();
    });
  });
});
