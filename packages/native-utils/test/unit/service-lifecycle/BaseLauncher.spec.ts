import type { Options } from '@wdio/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { BaseLauncher } from '../../../src/service-lifecycle/BaseLauncher.js';
import type { NativeServiceCapabilities } from '../../../src/service-lifecycle/types.js';

/**
 * Test implementation of BaseLauncher
 */
class TestLauncher extends BaseLauncher {
  public prepareCapabilitiesCalled = false;
  public validateConfigCalled = false;
  public onPrepareHookCalled = false;

  protected async validateConfig(_config: Options.Testrunner): Promise<void> {
    this.validateConfigCalled = true;
  }

  protected async prepareCapabilities(
    _config: Options.Testrunner,
    _capabilities: NativeServiceCapabilities,
  ): Promise<void> {
    this.prepareCapabilitiesCalled = true;
  }

  protected async onPrepareHook(_config: Options.Testrunner, _capabilities: NativeServiceCapabilities): Promise<void> {
    this.onPrepareHookCalled = true;
  }
}

describe('BaseLauncher', () => {
  let launcher: TestLauncher;
  let config: Options.Testrunner;
  let capabilities: NativeServiceCapabilities;

  beforeEach(() => {
    config = {
      rootDir: '/test/root',
    } as Options.Testrunner;

    capabilities = {};

    launcher = new TestLauncher({}, {}, config);
  });

  describe('constructor', () => {
    it('should initialize with global options', () => {
      const globalOptions = { rootDir: '/custom/root' };
      const customConfig = { rootDir: '/config/root' } as Options.Testrunner;

      const customLauncher = new TestLauncher(globalOptions, {}, customConfig);

      expect(customLauncher.globalOptions).toEqual(globalOptions);
    });

    it('should use global options rootDir over config rootDir', () => {
      const globalOptions = { rootDir: '/custom/root' };
      const customConfig = { rootDir: '/config/root' } as Options.Testrunner;

      const customLauncher = new TestLauncher(globalOptions, {}, customConfig);

      expect(customLauncher.projectRoot).toBe('/custom/root');
    });

    it('should use config rootDir if global options rootDir is not set', () => {
      const customConfig = { rootDir: '/config/root' } as Options.Testrunner;

      const customLauncher = new TestLauncher({}, {}, customConfig);

      expect(customLauncher.projectRoot).toBe('/config/root');
    });

    it('should use process.cwd() if neither rootDir is set', () => {
      const customConfig = {} as Options.Testrunner;

      const customLauncher = new TestLauncher({}, {}, customConfig);

      expect(customLauncher.projectRoot).toBe(process.cwd());
    });
  });

  describe('onPrepare', () => {
    it('should call lifecycle hooks in correct order', async () => {
      const callOrder: string[] = [];

      class OrderTestLauncher extends BaseLauncher {
        protected async validateConfig(): Promise<void> {
          callOrder.push('validateConfig');
        }

        protected async prepareCapabilities(): Promise<void> {
          callOrder.push('prepareCapabilities');
        }

        protected async onPrepareHook(): Promise<void> {
          callOrder.push('onPrepareHook');
        }
      }

      const orderLauncher = new OrderTestLauncher({}, {}, config);
      await orderLauncher.onPrepare(config, capabilities);

      expect(callOrder).toEqual(['validateConfig', 'prepareCapabilities', 'onPrepareHook']);
    });

    it('should call validateConfig', async () => {
      await launcher.onPrepare(config, capabilities);
      expect(launcher.validateConfigCalled).toBe(true);
    });

    it('should call prepareCapabilities', async () => {
      await launcher.onPrepare(config, capabilities);
      expect(launcher.prepareCapabilitiesCalled).toBe(true);
    });

    it('should call onPrepareHook', async () => {
      await launcher.onPrepare(config, capabilities);
      expect(launcher.onPrepareHookCalled).toBe(true);
    });

    it('should handle errors from prepareCapabilities', async () => {
      class ErrorLauncher extends BaseLauncher {
        protected async prepareCapabilities(): Promise<void> {
          throw new Error('Preparation failed');
        }
      }

      const errorLauncher = new ErrorLauncher({}, {}, config);

      await expect(errorLauncher.onPrepare(config, capabilities)).rejects.toThrow('Preparation failed');
    });
  });

  describe('onComplete', () => {
    it('should have default implementation that does not throw', async () => {
      await expect(launcher.onComplete(0, config, {})).resolves.toBeUndefined();
    });

    it('should be overridable', async () => {
      let onCompleteCalled = false;

      class CustomLauncher extends BaseLauncher {
        protected async prepareCapabilities(): Promise<void> {
          // Required implementation
        }

        async onComplete(): Promise<void> {
          onCompleteCalled = true;
        }
      }

      const customLauncher = new CustomLauncher({}, {}, config);
      await customLauncher.onComplete(0, config, {});

      expect(onCompleteCalled).toBe(true);
    });
  });

  describe('abstract method enforcement', () => {
    it('should require prepareCapabilities implementation', () => {
      // This test verifies that TypeScript enforces the abstract method
      // If you try to create a class without implementing prepareCapabilities, it won't compile
      expect(() => {
        class IncompleteLauncher extends BaseLauncher {
          // Missing prepareCapabilities - this would be a TypeScript error
        }
        // @ts-expect-error Testing abstract class
        return new IncompleteLauncher({}, {}, config);
      }).toBeDefined();
    });
  });

  describe('integration with WebdriverIO', () => {
    it('should be compatible with Services.ServiceInstance interface', () => {
      // Verify the class implements the required interface
      expect(launcher.onPrepare).toBeInstanceOf(Function);
      expect(launcher.onComplete).toBeInstanceOf(Function);
    });

    it('should pass config and capabilities to hooks', async () => {
      let capturedConfig: Options.Testrunner | undefined;
      let capturedCapabilities: NativeServiceCapabilities | undefined;

      class CapturingLauncher extends BaseLauncher {
        protected async prepareCapabilities(
          config: Options.Testrunner,
          capabilities: NativeServiceCapabilities,
        ): Promise<void> {
          capturedConfig = config;
          capturedCapabilities = capabilities;
        }
      }

      const capturingLauncher = new CapturingLauncher({}, {}, config);
      const testCapabilities = { browserName: 'electron' };

      await capturingLauncher.onPrepare(config, testCapabilities);

      expect(capturedConfig).toBe(config);
      expect(capturedCapabilities).toBe(testCapabilities);
    });
  });
});
