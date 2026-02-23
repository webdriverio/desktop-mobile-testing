import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEmbeddedProvider } from '../src/embeddedProvider.js';

// Pin platform to linux for all tests so macOS auto-detection doesn't interfere.
// Individual tests that want to test the macOS path override it explicitly.
Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

afterEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
});

describe('isEmbeddedProvider', () => {
  describe('explicit driverProvider — always takes priority', () => {
    it('returns true for "embedded"', () => {
      expect(isEmbeddedProvider({ driverProvider: 'embedded' })).toBe(true);
    });

    it('returns false for "official"', () => {
      expect(isEmbeddedProvider({ driverProvider: 'official' })).toBe(false);
    });

    it('returns false for "crabnebula"', () => {
      expect(isEmbeddedProvider({ driverProvider: 'crabnebula' })).toBe(false);
    });

    it('"official" overrides TAURI_WEBDRIVER_PORT env var', () => {
      vi.stubEnv('TAURI_WEBDRIVER_PORT', '4445');
      expect(isEmbeddedProvider({ driverProvider: 'official' })).toBe(false);
    });

    it('"official" overrides macOS platform', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      expect(isEmbeddedProvider({ driverProvider: 'official' })).toBe(false);
    });
  });

  describe('auto-detection (no explicit driverProvider)', () => {
    it('returns true when TAURI_WEBDRIVER_PORT is set', () => {
      vi.stubEnv('TAURI_WEBDRIVER_PORT', '4445');
      expect(isEmbeddedProvider({})).toBe(true);
    });

    it('returns true on macOS', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      expect(isEmbeddedProvider({})).toBe(true);
    });

    it('returns false on Windows without TAURI_WEBDRIVER_PORT', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      expect(isEmbeddedProvider({})).toBe(false);
    });

    it('returns false on Linux without TAURI_WEBDRIVER_PORT', () => {
      expect(isEmbeddedProvider({})).toBe(false);
    });

    it('TAURI_WEBDRIVER_PORT takes effect on Windows too', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      vi.stubEnv('TAURI_WEBDRIVER_PORT', '9000');
      expect(isEmbeddedProvider({})).toBe(true);
    });
  });
});
