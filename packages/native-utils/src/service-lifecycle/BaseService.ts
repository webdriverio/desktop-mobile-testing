import type { Services } from '@wdio/types';
import type { NativeServiceGlobalOptions } from './types.js';

/**
 * Abstract base class for native worker services
 *
 * Services run in each test worker and are responsible for:
 * - Initializing the API bridge (CDP, Flutter DevTools, etc.)
 * - Adding framework-specific APIs to the browser object
 * - Managing mock state
 * - Handling window focus and lifecycle
 *
 * @example
 * ```typescript
 * class ElectronWorkerService extends BaseService {
 *   protected async initializeAPI(browser): Promise<void> {
 *     // Initialize CDP bridge
 *     const cdpBridge = await initCdpBridge(...);
 *
 *     // Add Electron API to browser
 *     browser.electron = getElectronAPI(browser, cdpBridge);
 *   }
 * }
 * ```
 */
export abstract class BaseService implements Services.ServiceInstance {
  protected globalOptions: NativeServiceGlobalOptions;
  public capabilities: WebdriverIO.Capabilities;
  protected browser?: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser;

  // Mock management configuration
  protected clearMocks = false;
  protected resetMocks = false;
  protected restoreMocks = false;

  constructor(globalOptions: NativeServiceGlobalOptions = {}, capabilities: WebdriverIO.Capabilities) {
    this.globalOptions = globalOptions;
    this.capabilities = capabilities;
  }

  /**
   * WebdriverIO hook: Called before session starts
   * This is the main entry point for service initialization
   *
   * @param capabilities - Session capabilities
   * @param specs - Test spec files
   * @param browser - Browser instance
   */
  async before(
    capabilities: WebdriverIO.Capabilities,
    _specs: string[],
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    this.browser = browser;

    // Initialize the framework API (CDP, Flutter DevTools, etc.)
    await this.initializeAPI(browser, capabilities);

    // Install any command overrides
    await this.installCommandOverrides();

    // Run any additional setup
    await this.afterInitialization(capabilities, browser);
  }

  /**
   * Abstract method: Initialize the framework-specific API
   * This is where you would:
   * - Set up the communication bridge (CDP, WebSocket, etc.)
   * - Add framework APIs to the browser object
   * - Configure debugging endpoints
   *
   * @param browser - Browser instance
   * @param capabilities - Session capabilities
   */
  protected abstract initializeAPI(
    browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
    capabilities: WebdriverIO.Capabilities,
  ): Promise<void>;

  /**
   * Optional hook: Install command overrides
   * Can be overridden to modify WebDriver commands
   */
  protected async installCommandOverrides(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override to install custom commands
  }

  /**
   * Optional hook: Additional setup after API initialization
   * Can be overridden by subclasses for custom initialization
   *
   * @param capabilities - Session capabilities
   * @param browser - Browser instance
   */
  protected async afterInitialization(
    _capabilities: WebdriverIO.Capabilities,
    _browser: WebdriverIO.Browser | WebdriverIO.MultiRemoteBrowser,
  ): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom initialization
  }

  /**
   * WebdriverIO hook: Called before each test
   * Default implementation handles mock cleanup
   */
  async beforeTest(): Promise<void> {
    if (this.clearMocks) {
      await this.handleClearMocks();
    }
    if (this.resetMocks) {
      await this.handleResetMocks();
    }
    if (this.restoreMocks) {
      await this.handleRestoreMocks();
    }
  }

  /**
   * WebdriverIO hook: Called before each command
   * Can be overridden for command interception
   *
   * @param commandName - Name of the command being executed
   * @param args - Command arguments
   */
  async beforeCommand(_commandName: string, _args: unknown[]): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for command interception
  }

  /**
   * WebdriverIO hook: Called after each command
   * Can be overridden for post-command logic
   *
   * @param commandName - Name of the command that was executed
   * @param args - Command arguments
   * @param result - Command result
   * @param error - Command error (if any)
   */
  async afterCommand(_commandName: string, _args: unknown[], _result: unknown, _error?: Error): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for post-command logic
  }

  /**
   * WebdriverIO hook: Called after session ends
   * Can be overridden for cleanup logic
   */
  async after(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for cleanup
  }

  /**
   * Optional hook: Clear all mocks
   * Framework-specific implementations can provide mock clearing logic
   */
  protected async handleClearMocks(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for framework-specific mock clearing
  }

  /**
   * Optional hook: Reset all mocks
   * Framework-specific implementations can provide mock reset logic
   */
  protected async handleResetMocks(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for framework-specific mock reset
  }

  /**
   * Optional hook: Restore all mocks
   * Framework-specific implementations can provide mock restoration logic
   */
  protected async handleRestoreMocks(): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for framework-specific mock restoration
  }
}
