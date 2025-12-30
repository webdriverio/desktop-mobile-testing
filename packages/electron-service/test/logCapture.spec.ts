import type { CDPSession, Browser as PuppeteerBrowser, Target } from 'puppeteer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronCdpBridge } from '../src/bridge.js';
import { LogCaptureManager } from '../src/logCapture.js';

// Mock dependencies
vi.mock('@wdio/native-utils', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../src/logForwarder.js', () => ({
  forwardLog: vi.fn(),
  shouldLog: vi.fn((level, minLevel) => {
    const priorities = { trace: 0, debug: 1, info: 2, warn: 3, error: 4 };
    return priorities[level as keyof typeof priorities] >= priorities[minLevel as keyof typeof priorities];
  }),
}));

vi.mock('../src/logParser.js', () => ({
  parseConsoleEvent: vi.fn((_event) => ({
    level: 'info',
    message: 'Parsed message',
    source: 'main',
    timestamp: Date.now(),
  })),
}));

describe('LogCaptureManager', () => {
  let manager: LogCaptureManager;
  let mockCdpBridge: ElectronCdpBridge;
  let mockPuppeteerBrowser: PuppeteerBrowser;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LogCaptureManager();

    // Mock CDP bridge
    mockCdpBridge = {
      send: vi.fn().mockResolvedValue({}),
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as ElectronCdpBridge;
  });

  describe('captureMainProcessLogs', () => {
    it('should enable Runtime domain', async () => {
      await manager.captureMainProcessLogs(mockCdpBridge, {
        captureMainProcessLogs: true,
        captureRendererLogs: false,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(mockCdpBridge.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should attach listener to CDP bridge', async () => {
      await manager.captureMainProcessLogs(mockCdpBridge, {
        captureMainProcessLogs: true,
        captureRendererLogs: false,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(mockCdpBridge.on).toHaveBeenCalledWith('Runtime.consoleAPICalled', expect.any(Function));
    });

    it('should attach listener with instance ID', async () => {
      await manager.captureMainProcessLogs(
        mockCdpBridge,
        {
          captureMainProcessLogs: true,
          captureRendererLogs: false,
          mainProcessLogLevel: 'info',
          rendererLogLevel: 'info',
        },
        'app1',
      );

      expect(mockCdpBridge.on).toHaveBeenCalledWith('Runtime.consoleAPICalled', expect.any(Function));
    });

    it('should handle errors gracefully', async () => {
      const errorBridge = {
        send: vi.fn().mockRejectedValue(new Error('CDP error')),
        on: vi.fn(),
        off: vi.fn(),
      } as unknown as ElectronCdpBridge;

      // Should not throw
      await expect(
        manager.captureMainProcessLogs(errorBridge, {
          captureMainProcessLogs: true,
          captureRendererLogs: false,
          mainProcessLogLevel: 'info',
          rendererLogLevel: 'info',
        }),
      ).resolves.toBeUndefined();
    });

    it('should forward logs when listener is called', async () => {
      const { forwardLog } = await import('../src/logForwarder.js');
      const { parseConsoleEvent } = await import('../src/logParser.js');

      let capturedListener: ((event: unknown) => void) | undefined;
      mockCdpBridge.on = vi.fn((event, listener) => {
        if (event === 'Runtime.consoleAPICalled') {
          capturedListener = listener as (event: unknown) => void;
        }
      });

      vi.mocked(parseConsoleEvent).mockReturnValue({
        level: 'info',
        message: 'Test message',
        source: 'main',
        timestamp: 123456,
      });

      await manager.captureMainProcessLogs(mockCdpBridge, {
        captureMainProcessLogs: true,
        captureRendererLogs: false,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(capturedListener).toBeDefined();

      // Trigger the listener
      capturedListener?.({ type: 'log', args: [], executionContextId: 1, timestamp: 123456 });

      expect(parseConsoleEvent).toHaveBeenCalled();
      expect(forwardLog).toHaveBeenCalledWith('main', 'info', 'Test message', 'info', undefined);
    });
  });

  describe('captureRendererLogs', () => {
    beforeEach(() => {
      const mockTarget = {
        type: vi.fn().mockReturnValue('page'),
        _targetId: 'target-123',
        createCDPSession: vi.fn().mockResolvedValue({
          send: vi.fn().mockResolvedValue({}),
          on: vi.fn(),
          off: vi.fn(),
          detach: vi.fn().mockResolvedValue(undefined),
        } as unknown as CDPSession),
      } as unknown as Target;

      mockPuppeteerBrowser = {
        targets: vi.fn().mockReturnValue([mockTarget]),
        on: vi.fn(),
      } as unknown as PuppeteerBrowser;
    });

    it('should attach to existing page targets', async () => {
      await manager.captureRendererLogs(mockPuppeteerBrowser, {
        captureMainProcessLogs: false,
        captureRendererLogs: true,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(mockPuppeteerBrowser.targets).toHaveBeenCalled();
    });

    it('should listen for new targets', async () => {
      await manager.captureRendererLogs(mockPuppeteerBrowser, {
        captureMainProcessLogs: false,
        captureRendererLogs: true,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(mockPuppeteerBrowser.on).toHaveBeenCalledWith('targetcreated', expect.any(Function));
    });

    it('should enable Runtime domain for each target', async () => {
      const mockCdpSession = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        off: vi.fn(),
        detach: vi.fn().mockResolvedValue(undefined),
      } as unknown as CDPSession;

      const mockTarget = {
        type: vi.fn().mockReturnValue('page'),
        _targetId: 'target-123',
        createCDPSession: vi.fn().mockResolvedValue(mockCdpSession),
      } as unknown as Target;

      mockPuppeteerBrowser.targets = vi.fn().mockReturnValue([mockTarget]);

      await manager.captureRendererLogs(mockPuppeteerBrowser, {
        captureMainProcessLogs: false,
        captureRendererLogs: true,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      expect(mockCdpSession.send).toHaveBeenCalledWith('Runtime.enable');
    });

    it('should handle errors when attaching to target', async () => {
      const mockTarget = {
        type: vi.fn().mockReturnValue('page'),
        _targetId: 'target-123',
        createCDPSession: vi.fn().mockRejectedValue(new Error('CDP session error')),
      } as unknown as Target;

      mockPuppeteerBrowser.targets = vi.fn().mockReturnValue([mockTarget]);

      // Should not throw
      await expect(
        manager.captureRendererLogs(mockPuppeteerBrowser, {
          captureMainProcessLogs: false,
          captureRendererLogs: true,
          mainProcessLogLevel: 'info',
          rendererLogLevel: 'info',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('stopCapture', () => {
    it('should remove main process listener', async () => {
      await manager.captureMainProcessLogs(mockCdpBridge, {
        captureMainProcessLogs: true,
        captureRendererLogs: false,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      manager.stopCapture();

      expect(mockCdpBridge.off).toHaveBeenCalledWith('Runtime.consoleAPICalled', expect.any(Function));
    });

    it('should detach renderer CDP sessions', async () => {
      const mockCdpSession = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        off: vi.fn(),
        detach: vi.fn().mockResolvedValue(undefined),
      } as unknown as CDPSession;

      const mockTarget = {
        type: vi.fn().mockReturnValue('page'),
        _targetId: 'target-123',
        createCDPSession: vi.fn().mockResolvedValue(mockCdpSession),
      } as unknown as Target;

      mockPuppeteerBrowser = {
        targets: vi.fn().mockReturnValue([mockTarget]),
        on: vi.fn(),
      } as unknown as PuppeteerBrowser;

      await manager.captureRendererLogs(mockPuppeteerBrowser, {
        captureMainProcessLogs: false,
        captureRendererLogs: true,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      manager.stopCapture();

      expect(mockCdpSession.off).toHaveBeenCalledWith('Runtime.consoleAPICalled', expect.any(Function));
      expect(mockCdpSession.detach).toHaveBeenCalled();
    });

    it('should handle errors during cleanup gracefully', async () => {
      const mockCdpSession = {
        send: vi.fn().mockResolvedValue({}),
        on: vi.fn(),
        off: vi.fn().mockImplementation(() => {
          throw new Error('Off error');
        }),
        detach: vi.fn().mockRejectedValue(new Error('Detach error')),
      } as unknown as CDPSession;

      const mockTarget = {
        type: vi.fn().mockReturnValue('page'),
        _targetId: 'target-123',
        createCDPSession: vi.fn().mockResolvedValue(mockCdpSession),
      } as unknown as Target;

      mockPuppeteerBrowser = {
        targets: vi.fn().mockReturnValue([mockTarget]),
        on: vi.fn(),
      } as unknown as PuppeteerBrowser;

      await manager.captureRendererLogs(mockPuppeteerBrowser, {
        captureMainProcessLogs: false,
        captureRendererLogs: true,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      // Should not throw
      expect(() => manager.stopCapture()).not.toThrow();
    });

    it('should handle calling stopCapture without initialization', () => {
      // Should not throw
      expect(() => manager.stopCapture()).not.toThrow();
    });

    it('should handle calling stopCapture multiple times', async () => {
      await manager.captureMainProcessLogs(mockCdpBridge, {
        captureMainProcessLogs: true,
        captureRendererLogs: false,
        mainProcessLogLevel: 'info',
        rendererLogLevel: 'info',
      });

      manager.stopCapture();
      manager.stopCapture();

      // Should only call off once
      expect(mockCdpBridge.off).toHaveBeenCalledTimes(1);
    });
  });
});
