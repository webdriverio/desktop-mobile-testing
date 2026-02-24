import { describe, expect, it } from 'vitest';
import { isEmbeddedProvider } from '../src/embeddedProvider.js';

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
  });

  describe('default behavior (no explicit driverProvider)', () => {
    it('returns true when no driverProvider is set', () => {
      expect(isEmbeddedProvider({})).toBe(true);
    });

    it('returns true on macOS with no driverProvider', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      expect(isEmbeddedProvider({})).toBe(true);
    });

    it('returns true on Windows with no driverProvider', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      expect(isEmbeddedProvider({})).toBe(true);
    });

    it('returns true on Linux with no driverProvider', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      expect(isEmbeddedProvider({})).toBe(true);
    });
  });
});
