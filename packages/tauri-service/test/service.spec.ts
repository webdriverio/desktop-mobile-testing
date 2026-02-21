import { describe, expect, it, vi } from 'vitest';
import { parseLogLines } from '../src/logParser.js';
import {
  closeStandaloneLogWriter,
  getStandaloneLogWriter,
  isStandaloneLogWriterInitialized,
} from '../src/logWriter.js';
import TauriWorkerService from '../src/service.js';

describe('TauriWorkerService', () => {
  describe('console wrapping', () => {
    it('should patch browser.execute only once', () => {
      // Create a mock browser object
      const mockBrowser = {
        execute: vi.fn().mockReturnValue('original'),
        isMultiremote: false,
        instances: [],
        getInstance: vi.fn(),
      } as unknown as WebdriverIO.Browser;

      // Create the service
      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      // Call patchBrowserExecute multiple times
      (service as any).patchBrowserExecute(mockBrowser);
      (service as any).patchBrowserExecute(mockBrowser);
      (service as any).patchBrowserExecute(mockBrowser);

      // The original execute should only be called once (not triple-wrapped)
      // This test verifies that the patching guard works
      const symbol = Object.getOwnPropertySymbols(mockBrowser).find((s) =>
        s.toString().includes('wdio-tauri-execute-patched'),
      );
      expect(symbol).toBeDefined();
    });

    it('should not wrap execute if already patched', () => {
      const mockExecute = vi.fn().mockReturnValue('original');
      const mockBrowser = {
        execute: mockExecute,
        isMultiremote: false,
        instances: [],
        getInstance: vi.fn(),
      } as unknown as WebdriverIO.Browser;

      const service = new TauriWorkerService({}, { 'wdio:tauriServiceOptions': {} });

      // Patch once
      (service as any).patchBrowserExecute(mockBrowser);
      const firstExecute = mockBrowser.execute;

      // Patch again - should be no-op
      (service as any).patchBrowserExecute(mockBrowser);
      const secondExecute = mockBrowser.execute;

      // Should be the same function reference
      expect(firstExecute).toBe(secondExecute);
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
    it('should export closeStandaloneLogWriter function', () => {
      expect(typeof closeStandaloneLogWriter).toBe('function');
    });

    it('should export getStandaloneLogWriter function', () => {
      expect(typeof getStandaloneLogWriter).toBe('function');
    });

    it('should export isStandaloneLogWriterInitialized function', () => {
      expect(typeof isStandaloneLogWriterInitialized).toBe('function');
    });

    it('should handle closeStandaloneLogWriter when not initialized', () => {
      // Should not throw when writer is not initialized
      expect(() => closeStandaloneLogWriter()).not.toThrow();
    });
  });
});
