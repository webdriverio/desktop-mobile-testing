import { describe, expect, it } from 'vitest';

import { getPlatformCommand, validateDeeplinkUrl } from '../../src/commands/triggerDeeplink.js';

describe('triggerDeeplink Command', () => {
  describe('validateDeeplinkUrl', () => {
    it('should accept valid custom protocol URLs', () => {
      expect(validateDeeplinkUrl('myapp://test')).toBe('myapp://test');
      expect(validateDeeplinkUrl('myapp://open?file=test.txt')).toBe('myapp://open?file=test.txt');
      expect(validateDeeplinkUrl('custom-proto://action?param=value')).toBe('custom-proto://action?param=value');
    });

    it('should reject http protocol', () => {
      expect(() => validateDeeplinkUrl('http://example.com')).toThrow(
        'Invalid deeplink protocol: http. Expected a custom protocol (e.g., myapp://).',
      );
    });

    it('should reject https protocol', () => {
      expect(() => validateDeeplinkUrl('https://example.com')).toThrow(
        'Invalid deeplink protocol: https. Expected a custom protocol (e.g., myapp://).',
      );
    });

    it('should reject file protocol', () => {
      expect(() => validateDeeplinkUrl('file:///path/to/file')).toThrow(
        'Invalid deeplink protocol: file. Expected a custom protocol (e.g., myapp://).',
      );
    });

    it('should reject malformed URLs', () => {
      expect(() => validateDeeplinkUrl('not a url')).toThrow('Invalid deeplink URL: not a url');
      expect(() => validateDeeplinkUrl('://')).toThrow('Invalid deeplink URL: ://');
      expect(() => validateDeeplinkUrl('')).toThrow('Invalid deeplink URL: ');
    });
  });

  describe('getPlatformCommand', () => {
    it('should generate Windows command', () => {
      const result = getPlatformCommand('myapp://test', 'win32');
      expect(result.command).toBe('rundll32.exe');
      expect(result.args).toEqual(['url.dll,FileProtocolHandler', 'myapp://test']);
    });

    it('should generate macOS command', () => {
      const result = getPlatformCommand('myapp://test', 'darwin');
      expect(result.command).toBe('open');
      expect(result.args).toEqual(['myapp://test']);
    });

    it('should generate Linux command', () => {
      const result = getPlatformCommand('myapp://test', 'linux');
      expect(result.command).toBe('gio');
      expect(result.args).toEqual(['open', 'myapp://test']);
    });

    it('should handle URLs with query parameters', () => {
      const result = getPlatformCommand('myapp://test?foo=bar&baz=qux', 'darwin');
      expect(result.args).toEqual(['myapp://test?foo=bar&baz=qux']);
    });

    it('should throw for unsupported platforms', () => {
      expect(() => getPlatformCommand('myapp://test', 'freebsd')).toThrow(
        'Unsupported platform for deeplink triggering: freebsd. Supported platforms are: win32, darwin, linux.',
      );
      expect(() => getPlatformCommand('myapp://test', 'unknown')).toThrow(
        'Unsupported platform for deeplink triggering: unknown. Supported platforms are: win32, darwin, linux.',
      );
    });
  });
});
