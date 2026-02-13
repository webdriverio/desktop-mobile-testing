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
    it('should create capabilities with required fields', () => {
      const caps = createElectronCapabilities('/path/to/app');

      expect(caps).toMatchObject({
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

    it('should include appEntryPoint when provided', () => {
      const caps = createElectronCapabilities('/path/to/app', './main.js');

      expect(caps).toMatchObject({
        'wdio:electronServiceOptions': {
          appBinaryPath: '/path/to/app',
          appEntryPoint: './main.js',
        },
      });
    });

    it('should include appArgs when provided', () => {
      const caps = createElectronCapabilities('/path/to/app', undefined, {
        appArgs: ['--flag', '--other'],
      });

      expect(caps).toMatchObject({
        'goog:chromeOptions': {
          args: ['--flag', '--other'],
        },
        'wdio:electronServiceOptions': {
          appArgs: ['--flag', '--other'],
        },
      });
    });
  });
});
