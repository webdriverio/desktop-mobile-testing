import type { ElectronServiceGlobalOptions } from '@wdio/native-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoist mock creation before all imports
const { mockSpawn } = vi.hoisted(() => {
  return {
    mockSpawn: vi.fn(),
  };
});

// Mock child_process before importing
vi.mock('node:child_process', () => ({
  default: {
    spawn: mockSpawn,
  },
  spawn: mockSpawn,
}));

// Mock logger
vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

// Import after mocks are set up
import {
  appendUserDataDir,
  executeDeeplinkCommand,
  getPlatformCommand,
  triggerDeeplink,
  validateDeeplinkUrl,
} from '../../src/commands/triggerDeeplink.js';

describe('validateDeeplinkUrl', () => {
  it('should accept valid custom protocol URLs', () => {
    expect(validateDeeplinkUrl('myapp://test')).toBe('myapp://test');
    expect(validateDeeplinkUrl('custom://action?param=value')).toBe('custom://action?param=value');
    expect(validateDeeplinkUrl('app123://deep/path')).toBe('app123://deep/path');
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

  it('should handle URLs with complex query strings', () => {
    const url = 'myapp://test?foo=bar&array[]=a&array[]=b&nested[key]=value';
    expect(validateDeeplinkUrl(url)).toBe(url);
  });

  it('should handle URLs with fragments', () => {
    const url = 'myapp://test#fragment';
    expect(validateDeeplinkUrl(url)).toBe(url);
  });

  it('should handle URLs with both query and fragment', () => {
    const url = 'myapp://test?foo=bar#fragment';
    expect(validateDeeplinkUrl(url)).toBe(url);
  });
});

describe('appendUserDataDir', () => {
  it('should append userData parameter to URL without query string', () => {
    const result = appendUserDataDir('myapp://test', '/tmp/user-data');
    expect(result).toBe('myapp://test?userData=%2Ftmp%2Fuser-data');
  });

  it('should append userData parameter to URL with existing query string', () => {
    const result = appendUserDataDir('myapp://test?foo=bar', '/tmp/user-data');
    expect(result).toBe('myapp://test?foo=bar&userData=%2Ftmp%2Fuser-data');
  });

  it('should preserve existing query parameters', () => {
    const result = appendUserDataDir('myapp://test?param1=value1&param2=value2', '/custom/path');
    const url = new URL(result);
    expect(url.searchParams.get('param1')).toBe('value1');
    expect(url.searchParams.get('param2')).toBe('value2');
    expect(url.searchParams.get('userData')).toBe('/custom/path');
  });

  it('should overwrite existing userData parameter', () => {
    const result = appendUserDataDir('myapp://test?userData=/old/path', '/new/path');
    expect(result).toBe('myapp://test?userData=%2Fnew%2Fpath');
  });

  it('should handle URLs with fragments', () => {
    const result = appendUserDataDir('myapp://test#fragment', '/tmp/user-data');
    const url = new URL(result);
    expect(url.searchParams.get('userData')).toBe('/tmp/user-data');
    expect(url.hash).toBe('#fragment');
  });

  it('should handle complex query parameters (arrays)', () => {
    const result = appendUserDataDir('myapp://test?array[]=a&array[]=b', '/tmp/user-data');
    const url = new URL(result);
    expect(url.searchParams.get('array[]')).toBe('a'); // First value
    expect(url.searchParams.get('userData')).toBe('/tmp/user-data');
  });

  it('should handle Windows paths with backslashes', () => {
    const result = appendUserDataDir('myapp://test', 'C:\\Users\\Test\\AppData');
    const url = new URL(result);
    expect(url.searchParams.get('userData')).toBe('C:\\Users\\Test\\AppData');
  });
});

describe('getPlatformCommand', () => {
  describe('Windows (win32)', () => {
    it('should return correct command for Windows', () => {
      const result = getPlatformCommand('myapp://test', 'win32', 'C:\\app.exe');
      expect(result).toEqual({
        command: 'cmd',
        args: ['/c', 'start', '', 'myapp://test'],
      });
    });

    it('should throw error if appBinaryPath is missing', () => {
      expect(() => getPlatformCommand('myapp://test', 'win32')).toThrow(
        'triggerDeeplink requires appBinaryPath to be configured on Windows. ' +
          'Please set appBinaryPath in your wdio:electronServiceOptions.',
      );
    });

    it('should throw error if appBinaryPath is undefined', () => {
      expect(() => getPlatformCommand('myapp://test', 'win32', undefined)).toThrow(
        'triggerDeeplink requires appBinaryPath to be configured on Windows.',
      );
    });

    it('should handle URLs with query parameters', () => {
      const result = getPlatformCommand('myapp://test?foo=bar&userData=/tmp/data', 'win32', 'C:\\app.exe');
      expect(result.args).toContain('myapp://test?foo=bar&userData=/tmp/data');
    });
  });

  describe('macOS (darwin)', () => {
    it('should return correct command for macOS', () => {
      const result = getPlatformCommand('myapp://test', 'darwin');
      expect(result).toEqual({
        command: 'open',
        args: ['myapp://test'],
      });
    });

    it('should not require appBinaryPath for macOS', () => {
      const result = getPlatformCommand('myapp://test', 'darwin', undefined);
      expect(result.command).toBe('open');
    });

    it('should handle URLs with query parameters', () => {
      const result = getPlatformCommand('myapp://test?foo=bar', 'darwin');
      expect(result.args).toEqual(['myapp://test?foo=bar']);
    });
  });

  describe('Linux', () => {
    it('should return correct command for Linux', () => {
      const result = getPlatformCommand('myapp://test', 'linux');
      expect(result).toEqual({
        command: 'xdg-open',
        args: ['myapp://test'],
      });
    });

    it('should not require appBinaryPath for Linux', () => {
      const result = getPlatformCommand('myapp://test', 'linux', undefined);
      expect(result.command).toBe('xdg-open');
    });

    it('should handle URLs with query parameters', () => {
      const result = getPlatformCommand('myapp://test?foo=bar', 'linux');
      expect(result.args).toEqual(['myapp://test?foo=bar']);
    });
  });

  describe('Unsupported platforms', () => {
    it('should throw error for unsupported platform', () => {
      expect(() => getPlatformCommand('myapp://test', 'freebsd')).toThrow(
        'Unsupported platform for deeplink triggering: freebsd. ' + 'Supported platforms are: win32, darwin, linux.',
      );
    });

    it('should throw error for unknown platform', () => {
      expect(() => getPlatformCommand('myapp://test', 'unknown')).toThrow(
        'Unsupported platform for deeplink triggering: unknown.',
      );
    });
  });
});

describe('executeDeeplinkCommand', () => {
  let mockChildProcess: any;

  beforeEach(() => {
    mockSpawn.mockClear();
    mockChildProcess = {
      on: vi.fn(),
      unref: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  it('should spawn command with correct parameters', async () => {
    await executeDeeplinkCommand('open', ['myapp://test'], 5000);

    expect(mockSpawn).toHaveBeenCalledWith(
      'open',
      ['myapp://test'],
      expect.objectContaining({
        detached: true,
        stdio: 'ignore',
      }),
    );
  });

  it('should unref the child process', async () => {
    await executeDeeplinkCommand('open', ['myapp://test'], 5000);
    expect(mockChildProcess.unref).toHaveBeenCalled();
  });

  it('should use shell: true on Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    await executeDeeplinkCommand('cmd', ['/c', 'start', '', 'myapp://test'], 5000);

    expect(mockSpawn).toHaveBeenCalledWith(
      'cmd',
      ['/c', 'start', '', 'myapp://test'],
      expect.objectContaining({
        shell: true,
      }),
    );

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  it('should resolve promise on successful spawn', async () => {
    await expect(executeDeeplinkCommand('open', ['myapp://test'], 5000)).resolves.toBeUndefined();
  });

  it('should reject promise on spawn error', async () => {
    mockChildProcess.on.mockImplementation((event: string, callback: (error: Error) => void) => {
      if (event === 'error') {
        process.nextTick(() => callback(new Error('ENOENT')));
      }
    });

    await expect(executeDeeplinkCommand('invalid-command', ['myapp://test'], 5000)).rejects.toThrow(
      'Failed to trigger deeplink: ENOENT',
    );
  });

  it.skip('should reject promise on timeout', async () => {
    // Mock spawn to never call callbacks
    mockChildProcess.on.mockImplementation(() => {});

    await expect(executeDeeplinkCommand('open', ['myapp://test'], 100)).rejects.toThrow(
      'Deeplink command timed out after 100ms',
    );
  }, 10000);

  it('should handle spawn exceptions', async () => {
    mockSpawn.mockImplementation(() => {
      throw new Error('Spawn failed');
    });

    await expect(executeDeeplinkCommand('open', ['myapp://test'], 5000)).rejects.toThrow(
      'Failed to trigger deeplink: Spawn failed',
    );

    // Restore default mock implementation
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  it('should handle multiple args correctly', async () => {
    await executeDeeplinkCommand('cmd', ['/c', 'start', '', 'myapp://test'], 5000);

    expect(mockSpawn).toHaveBeenCalledWith('cmd', ['/c', 'start', '', 'myapp://test'], expect.any(Object));
  });

  it('should clear timeout on success', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    await executeDeeplinkCommand('open', ['myapp://test'], 5000);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should clear timeout on error', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    mockChildProcess.on.mockImplementation((event: string, callback: (error: Error) => void) => {
      if (event === 'error') {
        process.nextTick(() => callback(new Error('Test error')));
      }
    });

    await expect(executeDeeplinkCommand('open', ['myapp://test'], 5000)).rejects.toThrow();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

describe('triggerDeeplink', () => {
  let mockContext: {
    browser?: WebdriverIO.Browser;
    globalOptions: ElectronServiceGlobalOptions;
    userDataDir?: string;
  };
  let mockChildProcess: any;

  beforeEach(() => {
    mockSpawn.mockClear();
    mockContext = {
      globalOptions: {},
      userDataDir: undefined,
    };

    // Setup spawn mock for each test
    mockChildProcess = {
      on: vi.fn(),
      unref: vi.fn(),
    };
    mockSpawn.mockReturnValue(mockChildProcess as any);
  });

  describe('URL validation', () => {
    it('should validate URL before processing', async () => {
      mockContext.globalOptions = { appBinaryPath: 'C:\\app.exe' };

      await expect(triggerDeeplink.call(mockContext, 'https://example.com')).rejects.toThrow(
        'Invalid deeplink protocol: https',
      );
    });

    it('should reject malformed URLs', async () => {
      mockContext.globalOptions = { appBinaryPath: 'C:\\app.exe' };

      await expect(triggerDeeplink.call(mockContext, 'not a url')).rejects.toThrow('Invalid deeplink URL');
    });
  });

  describe('Windows platform behavior', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      mockSpawn.mockClear();
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should throw error if appBinaryPath is missing on Windows', async () => {
      mockContext.globalOptions = {};

      await expect(triggerDeeplink.call(mockContext, 'myapp://test')).rejects.toThrow(
        'triggerDeeplink requires appBinaryPath to be configured on Windows',
      );
    });

    it('should append userData to URL on Windows when userDataDir is set', async () => {
      mockContext.globalOptions = { appBinaryPath: 'C:\\app.exe' };
      mockContext.userDataDir = 'C:\\Users\\Test\\AppData';

      await triggerDeeplink.call(mockContext, 'myapp://test');

      // Verify that spawn was called with a URL containing userData
      const spawnCall = mockSpawn.mock.calls[0];
      const urlArg = spawnCall[1][3]; // The URL is the 4th argument in ['/c', 'start', '', url]
      expect(urlArg).toContain('userData=');
    });

    it('should not append userData on Windows when userDataDir is missing', async () => {
      mockContext.globalOptions = { appBinaryPath: 'C:\\app.exe' };
      mockContext.userDataDir = undefined;

      await triggerDeeplink.call(mockContext, 'myapp://test');

      // Verify that spawn was called with the original URL
      const spawnCall = mockSpawn.mock.calls[0];
      const urlArg = spawnCall[1][3];
      expect(urlArg).toBe('myapp://test');
    });
  });

  describe('macOS platform behavior', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      mockSpawn.mockClear();
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should not require appBinaryPath on macOS', async () => {
      mockContext.globalOptions = {};

      await expect(triggerDeeplink.call(mockContext, 'myapp://test')).resolves.toBeUndefined();
    });

    it('should not append userData on macOS', async () => {
      mockContext.globalOptions = {};
      mockContext.userDataDir = '/tmp/user-data';

      await triggerDeeplink.call(mockContext, 'myapp://test');

      // Verify that spawn was called with the original URL
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[1][0]).toBe('myapp://test');
      expect(spawnCall[1][0]).not.toContain('userData=');
    });
  });

  describe('Linux platform behavior', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
      mockSpawn.mockClear();
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should not require appBinaryPath on Linux', async () => {
      mockContext.globalOptions = {};

      await expect(triggerDeeplink.call(mockContext, 'myapp://test')).resolves.toBeUndefined();
    });

    it('should append userData on Linux', async () => {
      mockContext.globalOptions = {};
      mockContext.userDataDir = '/tmp/user-data';

      await triggerDeeplink.call(mockContext, 'myapp://test');

      // Verify that spawn was called with userData appended
      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[1][0]).toContain('userData=');
      expect(spawnCall[1][0]).toContain(encodeURIComponent('/tmp/user-data'));
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from executeDeeplinkCommand', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      mockContext.globalOptions = {};

      // Mock spawn to throw error
      mockChildProcess.on.mockImplementation((event: string, callback: (error: Error) => void) => {
        if (event === 'error') {
          process.nextTick(() => callback(new Error('Command failed')));
        }
      });

      await expect(triggerDeeplink.call(mockContext, 'myapp://test')).rejects.toThrow(
        'Failed to trigger deeplink: Command failed',
      );

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });
  });

  describe('Integration tests', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    it('should handle complete Windows flow with all options', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      mockContext.globalOptions = { appBinaryPath: 'C:\\app.exe' };
      mockContext.userDataDir = 'C:\\Users\\Test\\AppData';

      await triggerDeeplink.call(mockContext, 'myapp://test?foo=bar');

      expect(mockSpawn).toHaveBeenCalledWith(
        'cmd',
        expect.arrayContaining(['/c', 'start', '']),
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
          shell: true,
        }),
      );

      // Verify URL includes both original params and userData
      const spawnCall = mockSpawn.mock.calls[0];
      const urlArg = spawnCall[1][3]; // The URL is the 4th argument
      expect(urlArg).toContain('foo=bar');
      expect(urlArg).toContain('userData=');
    });

    it('should handle complete macOS flow', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      mockContext.globalOptions = {};

      await triggerDeeplink.call(mockContext, 'myapp://test?foo=bar');

      expect(mockSpawn).toHaveBeenCalledWith(
        'open',
        ['myapp://test?foo=bar'],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        }),
      );
    });

    it('should handle complete Linux flow', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      mockContext.globalOptions = {};

      await triggerDeeplink.call(mockContext, 'myapp://test?foo=bar');

      expect(mockSpawn).toHaveBeenCalledWith(
        'xdg-open',
        ['myapp://test?foo=bar'],
        expect.objectContaining({
          detached: true,
          stdio: 'ignore',
        }),
      );
    });

    it('should preserve complex URL parameters', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        configurable: true,
      });

      mockContext.globalOptions = {};

      const complexUrl = 'myapp://action?array[]=a&array[]=b&nested[key]=value#fragment';
      await triggerDeeplink.call(mockContext, complexUrl);

      const spawnCall = mockSpawn.mock.calls[0];
      expect(spawnCall[1][0]).toBe(complexUrl);
    });
  });
});
