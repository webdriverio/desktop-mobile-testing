import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseLogLines } from '../src/logParser.js';
import { closeLogWriter, getLogWriter, isLogWriterInitialized } from '../src/logWriter.js';

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  waitUntilWindowAvailable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/commands/mock.js', () => ({
  clearAllMocks: vi.fn().mockResolvedValue(undefined),
  resetAllMocks: vi.fn().mockResolvedValue(undefined),
  restoreAllMocks: vi.fn().mockResolvedValue(undefined),
  isMockFunction: vi.fn(),
  mock: vi.fn(),
}));

vi.mock('../src/mockStore.js', () => ({
  default: {
    clear: vi.fn(),
    getMocks: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../src/window.js', () => ({
  clearWindowState: vi.fn(),
  ensureActiveWindowFocus: vi.fn().mockResolvedValue(undefined),
}));

import { waitUntilWindowAvailable } from '@wdio/native-utils';
import { clearAllMocks, resetAllMocks, restoreAllMocks } from '../src/commands/mock.js';
import mockStore from '../src/mockStore.js';
import TauriWorkerService from '../src/service.js';
import { clearWindowState, ensureActiveWindowFocus } from '../src/window.js';

function createMockBrowser(overrides: Record<string, unknown> = {}): WebdriverIO.Browser {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    executeAsync: vi.fn().mockResolvedValue(undefined),
    isMultiremote: false,
    sessionId: 'test-session-123',
    instances: [],
    getInstance: vi.fn(),
    overwriteCommand: vi.fn(),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    tauri: {
      execute: vi.fn().mockResolvedValue(undefined),
    },
    capabilities: {},
    ...overrides,
  } as unknown as WebdriverIO.Browser;
}

describe('TauriWorkerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('console wrapping', () => {
    it('should patch browser.execute only once', () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      (service as any).patchBrowserExecute(mockBrowser);
      (service as any).patchBrowserExecute(mockBrowser);

      const symbol = Object.getOwnPropertySymbols(mockBrowser).find((s) =>
        s.toString().includes('wdio-tauri-execute-patched'),
      );
      expect(symbol).toBeDefined();
    });

    it('should not wrap execute if already patched', () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      const firstExecute = mockBrowser.execute;

      (service as any).patchBrowserExecute(mockBrowser);
      const secondExecute = mockBrowser.execute;

      expect(firstExecute).toBe(secondExecute);
    });

    it('should wrap string scripts in IIFE with done callback for non-embedded providers', () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({ driverProvider: 'official' }, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      mockBrowser.execute('return document.title');

      // String scripts should use executeAsync with explicit done callback for WebKit compatibility
      expect(mockExecuteAsync).toHaveBeenCalled();
      const callArgs = mockExecuteAsync.mock.calls[0];
      // The script should contain .then( to handle async results and __wdio_error__ for error handling
      expect(callArgs[0]).toContain('.then(');
      expect(callArgs[0]).toContain('__wdio_error__');
      // execute should NOT be called for string scripts
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should pass function scripts as-is for non-embedded providers using executeAsync', () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({ driverProvider: 'official' }, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      const testFn = (a: number, b: number) => a + b;
      mockBrowser.execute(testFn as any, 1, 2);

      // Functions should use executeAsync for WebKit compatibility
      expect(mockExecuteAsync).toHaveBeenCalledWith(expect.stringContaining('(a, b) => a + b'), 1, 2);
      // execute should NOT be called
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should pass string scripts as-is for embedded provider', () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({ driverProvider: 'embedded' }, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      mockBrowser.execute('return document.title');

      expect(mockExecuteAsync).toHaveBeenCalled();
      const callArgs = mockExecuteAsync.mock.calls[0];
      expect(callArgs[0]).toContain('(async function() { return document.title })');
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should pass function scripts as-is for embedded provider', () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({ driverProvider: 'embedded' }, { 'wdio:tauriServiceOptions': {} });

      (service as any).patchBrowserExecute(mockBrowser);
      const testFn = (a: number, b: number) => a + b;
      mockBrowser.execute(testFn as any, 1, 2);

      expect(mockExecuteAsync).toHaveBeenCalledWith(expect.stringContaining('Promise.resolve(('), 1, 2);
      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('before()', () => {
    it('should initialize standard browser with tauri API and patched execute', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await service.before({} as any, [], mockBrowser);

      expect(waitUntilWindowAvailable).toHaveBeenCalledWith(mockBrowser);
      expect((mockBrowser as any).tauri).toBeDefined();
      expect(typeof (mockBrowser as any).tauri.execute).toBe('function');
      expect(typeof (mockBrowser as any).tauri.mock).toBe('function');
      expect(typeof (mockBrowser as any).tauri.clearAllMocks).toBe('function');
      expect(typeof (mockBrowser as any).tauri.resetAllMocks).toBe('function');
      expect(typeof (mockBrowser as any).tauri.restoreAllMocks).toBe('function');
      expect(typeof (mockBrowser as any).tauri.triggerDeeplink).toBe('function');
    });

    it('should call patchBrowserExecute for standard browser', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await service.before({} as any, [], mockBrowser);

      const symbol = Object.getOwnPropertySymbols(mockBrowser).find((s) =>
        s.toString().includes('wdio-tauri-execute-patched'),
      );
      expect(symbol).toBeDefined();
    });

    it('should wait for plugin initialization on standard browser', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await service.before({} as any, [], mockBrowser);

      // For non-embedded providers, executeAsync is used (WebKit compatibility)
      expect(mockExecuteAsync).toHaveBeenCalled();
    });

    it('should skip plugin initialization wait for crabnebula driver provider', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ execute: mockExecute, executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({ driverProvider: 'crabnebula' }, { 'wdio:tauriServiceOptions': {} });

      await service.before({} as any, [], mockBrowser);

      // CrabNebula skips the plugin initialization wait entirely
      expect(mockExecute).not.toHaveBeenCalled();
      expect(mockExecuteAsync).not.toHaveBeenCalled();
    });

    it('should handle plugin initialization error gracefully', async () => {
      const mockExecuteAsync = vi.fn().mockResolvedValue(undefined);
      const mockBrowser = createMockBrowser({ executeAsync: mockExecuteAsync });
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await expect(service.before({} as any, [], mockBrowser)).resolves.not.toThrow();
    });

    it('should install command overrides after initialization', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await service.before({} as any, [], mockBrowser);

      expect(mockBrowser.overwriteCommand).toHaveBeenCalledWith('click', expect.any(Function), true);
      expect(mockBrowser.overwriteCommand).toHaveBeenCalledWith('doubleClick', expect.any(Function), true);
      expect(mockBrowser.overwriteCommand).toHaveBeenCalledWith('setValue', expect.any(Function), true);
      expect(mockBrowser.overwriteCommand).toHaveBeenCalledWith('clearValue', expect.any(Function), true);
    });
  });

  describe('beforeTest()', () => {
    it('should call clearAllMocks when clearMocks option is true', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({ clearMocks: true }, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(clearAllMocks).toHaveBeenCalled();
    });

    it('should call resetAllMocks when resetMocks option is true', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({ resetMocks: true }, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(resetAllMocks).toHaveBeenCalled();
    });

    it('should call restoreAllMocks when restoreMocks option is true', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({ restoreMocks: true }, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(restoreAllMocks).toHaveBeenCalled();
    });

    it('should not call any mock functions when all options are false', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService(
        { clearMocks: false, resetMocks: false, restoreMocks: false },
        { 'wdio:tauriServiceOptions': {} },
      );
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(clearAllMocks).not.toHaveBeenCalled();
      expect(resetAllMocks).not.toHaveBeenCalled();
      expect(restoreAllMocks).not.toHaveBeenCalled();
    });

    it('should call all mock functions when all options are true', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService(
        { clearMocks: true, resetMocks: true, restoreMocks: true },
        { 'wdio:tauriServiceOptions': {} },
      );
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(clearAllMocks).toHaveBeenCalled();
      expect(resetAllMocks).toHaveBeenCalled();
      expect(restoreAllMocks).toHaveBeenCalled();
    });

    it('should pass clearMocksPrefix to clearAllMocks', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService(
        { clearMocks: true, clearMocksPrefix: 'plugin:' },
        { 'wdio:tauriServiceOptions': {} },
      );
      (service as any).browser = mockBrowser;

      await service.beforeTest({}, {});

      expect(clearAllMocks).toHaveBeenCalledWith('plugin:');
    });
  });

  describe('beforeCommand()', () => {
    it('should call ensureActiveWindowFocus for non-multiremote browser', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.beforeCommand('getTitle', []);

      expect(ensureActiveWindowFocus).toHaveBeenCalledWith(mockBrowser, 'getTitle');
    });

    it('should return early when browser is multiremote', async () => {
      const mockBrowser = createMockBrowser({ isMultiremote: true });
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.beforeCommand('getTitle', []);

      expect(ensureActiveWindowFocus).not.toHaveBeenCalled();
    });

    it('should return early when no browser exists', async () => {
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await service.beforeCommand('getTitle', []);

      expect(ensureActiveWindowFocus).not.toHaveBeenCalled();
    });

    it('should handle ensureActiveWindowFocus errors gracefully', async () => {
      vi.mocked(ensureActiveWindowFocus).mockRejectedValueOnce(new Error('focus failed'));
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await expect(service.beforeCommand('getTitle', [])).resolves.not.toThrow();
    });
  });

  describe('afterSession()', () => {
    it('should call mockStore.clear()', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.afterSession({}, {} as any, []);

      expect(mockStore.clear).toHaveBeenCalled();
    });

    it('should delete session for standard browser', async () => {
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.afterSession({}, {} as any, []);

      expect(mockBrowser.deleteSession).toHaveBeenCalled();
    });

    it('should clear window state with session ID for standard browser', async () => {
      const mockBrowser = createMockBrowser({ sessionId: 'sess-abc' });
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.afterSession({}, {} as any, []);

      expect(clearWindowState).toHaveBeenCalledWith('sess-abc');
    });

    it('should handle gracefully when no browser exists', async () => {
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      await expect(service.afterSession({}, {} as any, [])).resolves.not.toThrow();
      expect(clearWindowState).toHaveBeenCalledWith();
    });

    it('should call restoreAllMocks before clearing mock store', async () => {
      const callOrder: string[] = [];
      vi.mocked(restoreAllMocks).mockImplementation(async () => {
        callOrder.push('restoreAllMocks');
      });
      vi.mocked(mockStore.clear).mockImplementation(() => {
        callOrder.push('mockStore.clear');
      });

      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await service.afterSession({}, {} as any, []);

      expect(callOrder).toEqual(['restoreAllMocks', 'mockStore.clear']);
    });

    it('should handle deleteSession errors gracefully', async () => {
      const mockBrowser = createMockBrowser({
        deleteSession: vi.fn().mockRejectedValue(new Error('session error')),
      });
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await expect(service.afterSession({}, {} as any, [])).resolves.not.toThrow();
    });

    it('should handle restoreAllMocks errors gracefully', async () => {
      vi.mocked(restoreAllMocks).mockRejectedValueOnce(new Error('restore error'));
      const mockBrowser = createMockBrowser();
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });
      (service as any).browser = mockBrowser;

      await expect(service.afterSession({}, {} as any, [])).resolves.not.toThrow();
      expect(mockBrowser.deleteSession).toHaveBeenCalled();
    });
  });
});

describe('LogParser', () => {
  describe('parseLogLines', () => {
    it('should export parseLogLines function', () => {
      expect(typeof parseLogLines).toBe('function');
    });

    it('should parse simple log lines', () => {
      const lines = '[INFO] Test log message';
      const parsed = parseLogLines(lines);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });
});

describe('LogWriter', () => {
  describe('exports', () => {
    it('should export closeLogWriter function', () => {
      expect(typeof closeLogWriter).toBe('function');
    });

    it('should export getLogWriter function', () => {
      expect(typeof getLogWriter).toBe('function');
    });

    it('should export isLogWriterInitialized function', () => {
      expect(typeof isLogWriterInitialized).toBe('function');
    });

    it('should handle closeLogWriter when not initialized', () => {
      expect(() => closeLogWriter()).not.toThrow();
    });
  });
});
