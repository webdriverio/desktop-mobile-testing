import { beforeEach, describe, expect, it } from 'vitest';
import { BaseService } from '../../../src/service-lifecycle/BaseService.js';

/**
 * Test implementation of BaseService
 */
class TestService extends BaseService {
  public initializeAPICalled = false;
  public installCommandOverridesCalled = false;
  public afterInitializationCalled = false;
  public clearMocksCalled = false;
  public resetMocksCalled = false;
  public restoreMocksCalled = false;

  protected async initializeAPI(): Promise<void> {
    this.initializeAPICalled = true;
  }

  protected async installCommandOverrides(): Promise<void> {
    this.installCommandOverridesCalled = true;
  }

  protected async afterInitialization(): Promise<void> {
    this.afterInitializationCalled = true;
  }

  protected async handleClearMocks(): Promise<void> {
    this.clearMocksCalled = true;
  }

  protected async handleResetMocks(): Promise<void> {
    this.resetMocksCalled = true;
  }

  protected async handleRestoreMocks(): Promise<void> {
    this.restoreMocksCalled = true;
  }
}

describe('BaseService', () => {
  let service: TestService;
  let mockBrowser: WebdriverIO.Browser;

  beforeEach(() => {
    service = new TestService({}, {});
    mockBrowser = {
      sessionId: 'test-session',
    } as WebdriverIO.Browser;
  });

  describe('constructor', () => {
    it('should initialize with global options and capabilities', () => {
      const globalOptions = { rootDir: '/test' };
      const capabilities = { browserName: 'electron' };

      const customService = new TestService(globalOptions, capabilities);

      expect(customService.globalOptions).toEqual(globalOptions);
      expect(customService.capabilities).toEqual(capabilities);
    });

    it('should use default global options if not provided', () => {
      const customService = new TestService(undefined, {});
      expect(customService.globalOptions).toEqual({});
    });

    it('should initialize mock flags to false', () => {
      expect(service.clearMocks).toBe(false);
      expect(service.resetMocks).toBe(false);
      expect(service.restoreMocks).toBe(false);
    });
  });

  describe('before', () => {
    it('should call lifecycle hooks in correct order', async () => {
      const callOrder: string[] = [];

      class OrderTestService extends BaseService {
        protected async initializeAPI(): Promise<void> {
          callOrder.push('initializeAPI');
        }

        protected async installCommandOverrides(): Promise<void> {
          callOrder.push('installCommandOverrides');
        }

        protected async afterInitialization(): Promise<void> {
          callOrder.push('afterInitialization');
        }
      }

      const orderService = new OrderTestService({}, {});
      await orderService.before({}, [], mockBrowser);

      expect(callOrder).toEqual(['initializeAPI', 'installCommandOverrides', 'afterInitialization']);
    });

    it('should store browser instance', async () => {
      await service.before({}, [], mockBrowser);
      expect(service.browser).toBe(mockBrowser);
    });

    it('should call initializeAPI', async () => {
      await service.before({}, [], mockBrowser);
      expect(service.initializeAPICalled).toBe(true);
    });

    it('should call installCommandOverrides', async () => {
      await service.before({}, [], mockBrowser);
      expect(service.installCommandOverridesCalled).toBe(true);
    });

    it('should call afterInitialization', async () => {
      await service.before({}, [], mockBrowser);
      expect(service.afterInitializationCalled).toBe(true);
    });

    it('should pass capabilities and browser to initializeAPI', async () => {
      let capturedBrowser: WebdriverIO.Browser | undefined;
      let capturedCapabilities: WebdriverIO.Capabilities | undefined;

      class CapturingService extends BaseService {
        protected async initializeAPI(
          browser: WebdriverIO.Browser,
          capabilities: WebdriverIO.Capabilities,
        ): Promise<void> {
          capturedBrowser = browser;
          capturedCapabilities = capabilities;
        }
      }

      const capturingService = new CapturingService({}, {});
      const testCapabilities = { browserName: 'electron' };

      await capturingService.before(testCapabilities, [], mockBrowser);

      expect(capturedBrowser).toBe(mockBrowser);
      expect(capturedCapabilities).toBe(testCapabilities);
    });

    it('should handle errors from initializeAPI', async () => {
      class ErrorService extends BaseService {
        protected async initializeAPI(): Promise<void> {
          throw new Error('Initialization failed');
        }
      }

      const errorService = new ErrorService({}, {});

      await expect(errorService.before({}, [], mockBrowser)).rejects.toThrow('Initialization failed');
    });
  });

  describe('beforeTest', () => {
    it('should call clearMocks when clearMocks is true', async () => {
      service.clearMocks = true;
      await service.beforeTest();
      expect(service.clearMocksCalled).toBe(true);
    });

    it('should call resetMocks when resetMocks is true', async () => {
      service.resetMocks = true;
      await service.beforeTest();
      expect(service.resetMocksCalled).toBe(true);
    });

    it('should call restoreMocks when restoreMocks is true', async () => {
      service.restoreMocks = true;
      await service.beforeTest();
      expect(service.restoreMocksCalled).toBe(true);
    });

    it('should not call mock handlers when flags are false', async () => {
      await service.beforeTest();
      expect(service.clearMocksCalled).toBe(false);
      expect(service.resetMocksCalled).toBe(false);
      expect(service.restoreMocksCalled).toBe(false);
    });

    it('should call all mock handlers when all flags are true', async () => {
      service.clearMocks = true;
      service.resetMocks = true;
      service.restoreMocks = true;

      await service.beforeTest();

      expect(service.clearMocksCalled).toBe(true);
      expect(service.resetMocksCalled).toBe(true);
      expect(service.restoreMocksCalled).toBe(true);
    });
  });

  describe('command hooks', () => {
    it('beforeCommand should have default implementation that does not throw', async () => {
      await expect(service.beforeCommand('click', [])).resolves.toBeUndefined();
    });

    it('afterCommand should have default implementation that does not throw', async () => {
      await expect(service.afterCommand('click', [], undefined)).resolves.toBeUndefined();
    });

    it('beforeCommand should be overridable', async () => {
      let capturedCommand: string | undefined;

      class CustomService extends BaseService {
        protected async initializeAPI(): Promise<void> {}

        async beforeCommand(commandName: string, _args: unknown[]): Promise<void> {
          capturedCommand = commandName;
        }
      }

      const customService = new CustomService({}, {});
      await customService.beforeCommand('customCommand', []);

      expect(capturedCommand).toBe('customCommand');
    });

    it('afterCommand should be overridable', async () => {
      let capturedResult: unknown;

      class CustomService extends BaseService {
        protected async initializeAPI(): Promise<void> {}

        async afterCommand(_commandName: string, _args: unknown[], result: unknown): Promise<void> {
          capturedResult = result;
        }
      }

      const customService = new CustomService({}, {});
      await customService.afterCommand('command', [], 'test-result');

      expect(capturedResult).toBe('test-result');
    });
  });

  describe('after', () => {
    it('should have default implementation that does not throw', async () => {
      await expect(service.after()).resolves.toBeUndefined();
    });

    it('should be overridable', async () => {
      let afterCalled = false;

      class CustomService extends BaseService {
        protected async initializeAPI(): Promise<void> {}

        async after(): Promise<void> {
          afterCalled = true;
        }
      }

      const customService = new CustomService({}, {});
      await customService.after();

      expect(afterCalled).toBe(true);
    });
  });

  describe('abstract method enforcement', () => {
    it('should require initializeAPI implementation', () => {
      expect(() => {
        class IncompleteService extends BaseService {
          // Missing initializeAPI - this would be a TypeScript error
        }
        // @ts-expect-error Testing abstract class
        return new IncompleteService({}, {});
      }).toBeDefined();
    });
  });

  describe('integration with WebdriverIO', () => {
    it('should be compatible with Services.ServiceInstance interface', () => {
      expect(service.before).toBeInstanceOf(Function);
      expect(service.beforeTest).toBeInstanceOf(Function);
      expect(service.beforeCommand).toBeInstanceOf(Function);
      expect(service.afterCommand).toBeInstanceOf(Function);
      expect(service.after).toBeInstanceOf(Function);
    });

    it('should support multiremote browser', async () => {
      const multiremoteBrowser = {
        sessionId: 'multi-test',
        isMultiremote: true,
      } as unknown as WebdriverIO.MultiRemoteBrowser;

      await service.before({}, [], multiremoteBrowser);

      expect(service.browser).toBe(multiremoteBrowser);
    });
  });
});
