import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanup, createElectronCapabilities, init } from '../src/session.js';

const browserMock = { mockBrowser: true };
const onPrepareMock = vi.fn();
const onWorkerStartMock = vi.fn();
const beforeMock = vi.fn();

vi.mock('../src/service.js', () => ({
  default: class MockElectronWorkerService {
    async before(...args: unknown[]) {
      beforeMock(...args);
    }
  },
}));
vi.mock('../src/launcher.js', () => ({
  default: class MockElectronLaunchService {
    async onPrepare(...args: unknown[]) {
      onPrepareMock(...args);
    }
    async onWorkerStart(...args: unknown[]) {
      onWorkerStartMock(...args);
    }
  },
}));
vi.mock('webdriverio', () => ({
  remote: async () => Promise.resolve(browserMock),
}));

const mockInitialize = vi.fn();
const mockGetLogDir = vi.fn().mockReturnValue('/mock/logs');
const mockClose = vi.fn();

vi.mock('../src/logWriter.js', () => ({
  getStandaloneLogWriter: () => ({
    initialize: mockInitialize,
    getLogDir: mockGetLogDir,
    close: mockClose,
  }),
}));

describe('Session Management', () => {
  describe('init()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });
    it('should create a new browser session', async () => {
      const session = await init({});
      expect(session).toStrictEqual(browserMock);
    });

    it('should call onPrepare with the expected parameters', async () => {
      const expectedCaps = {
        browserName: 'electron',
        browserVersion: '99.9.9',
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/binary',
        },
        'goog:chromeOptions': {
          args: ['--disable-dev-shm-usage', '--disable-gpu', '--headless'],
        },
        'wdio:chromedriverOptions': {
          binary: '/path/to/chromedriver',
        },
      };
      await init([expectedCaps]);
      expect(onPrepareMock).toHaveBeenCalledWith({}, [expectedCaps]);
      expect(onWorkerStartMock).toHaveBeenCalledWith('', [expectedCaps]);
    });

    it('should call onPrepare with the expected parameters when a rootDir is specified', async () => {
      await init(
        [
          {
            browserName: 'electron',
            'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' },
          },
        ],
        {
          rootDir: '/path/to/root',
        },
      );
      expect(onPrepareMock).toHaveBeenCalledWith({ rootDir: '/path/to/root' }, [
        {
          browserName: 'electron',
          'wdio:electronServiceOptions': {
            appBinaryPath: '/path/to/binary',
          },
        },
      ]);
    });

    it('should call before with the expected parameters', async () => {
      const caps = { 'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' } };
      await init([caps]);
      expect(beforeMock).toHaveBeenCalledWith(caps, [], browserMock);
    });

    it('should initialize log writer when captureMainProcessLogs is enabled with logDir', async () => {
      mockInitialize.mockClear();

      await init({
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/app',
          captureMainProcessLogs: true,
          logDir: '/logs',
        },
      } as unknown as import('@wdio/native-types').ElectronServiceCapabilities);

      expect(mockInitialize).toHaveBeenCalledWith('/logs');
    });

    it('should initialize log writer when captureRendererLogs is enabled with logDir', async () => {
      mockInitialize.mockClear();

      await init({
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/app',
          captureRendererLogs: true,
          logDir: '/logs',
        },
      } as unknown as import('@wdio/native-types').ElectronServiceCapabilities);

      expect(mockInitialize).toHaveBeenCalledWith('/logs');
    });

    it('should warn when logging enabled without logDir', async () => {
      mockInitialize.mockClear();

      await init({
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/app',
          captureMainProcessLogs: true,
        },
      } as unknown as import('@wdio/native-types').ElectronServiceCapabilities);

      expect(mockInitialize).not.toHaveBeenCalled();
    });
  });

  describe('cleanup()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockClose.mockClear();
    });

    it('should clean up a browser session that was initialized', async () => {
      const caps = { 'wdio:electronServiceOptions': { appBinaryPath: '/path/to/binary' } };
      const browser = await init([caps]);
      await expect(cleanup(browser)).resolves.toBeUndefined();
      expect(mockClose).toHaveBeenCalled();
    });

    it('should warn when cleaning up an unknown browser instance', async () => {
      await cleanup({ unknown: true } as unknown as WebdriverIO.Browser);

      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe('createElectronCapabilities()', () => {
    it('should create capabilities with appBinaryPath', () => {
      const caps = createElectronCapabilities({ appBinaryPath: '/path/to/app' });

      expect(caps).toStrictEqual({
        browserName: 'electron',
        'goog:chromeOptions': {
          binary: '/path/to/app',
          args: [],
        },
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/app',
        },
      });
    });

    it('should create capabilities with appEntryPoint', () => {
      const caps = createElectronCapabilities({ appEntryPoint: './main.js' });

      expect(caps).toStrictEqual({
        browserName: 'electron',
        'wdio:electronServiceOptions': {
          appEntryPoint: './main.js',
        },
      });
      expect(caps['goog:chromeOptions']).toBeUndefined();
    });

    it('should include appArgs in both chromeOptions and serviceOptions', () => {
      const caps = createElectronCapabilities({
        appBinaryPath: '/path/to/app',
        appArgs: ['--flag', '--other'],
      });

      expect(caps['goog:chromeOptions']).toStrictEqual({
        binary: '/path/to/app',
        args: ['--flag', '--other'],
      });
      expect(caps['wdio:electronServiceOptions']?.appArgs).toStrictEqual(['--flag', '--other']);
    });

    it('should pass through all service options', () => {
      const caps = createElectronCapabilities({
        appBinaryPath: '/path/to/app',
        captureMainProcessLogs: true,
        mainProcessLogLevel: 'debug',
        logDir: './logs',
        clearMocks: true,
      });

      expect(caps['wdio:electronServiceOptions']).toMatchObject({
        appBinaryPath: '/path/to/app',
        captureMainProcessLogs: true,
        mainProcessLogLevel: 'debug',
        logDir: './logs',
        clearMocks: true,
      });
    });

    it('should throw when neither appBinaryPath nor appEntryPoint is provided', () => {
      expect(() => createElectronCapabilities({})).toThrow('Either appBinaryPath or appEntryPoint must be provided');
    });
  });
});
