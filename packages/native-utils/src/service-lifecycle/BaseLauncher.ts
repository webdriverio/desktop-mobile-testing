import type { Capabilities, Options, Services } from '@wdio/types';
import type { NativeServiceCapabilities, NativeServiceGlobalOptions } from './types.js';

/**
 * Abstract base class for native service launchers
 *
 * Launchers run once per test suite and are responsible for:
 * - Validating configuration
 * - Setting up capabilities
 * - Preparing the environment for tests
 *
 * @example
 * ```typescript
 * class ElectronLauncher extends BaseLauncher {
 *   protected async prepareCapabilities(config, caps): Promise<void> {
 *     // Electron-specific capability preparation
 *     // - Detect binary path
 *     // - Set Chrome options
 *     // - Configure debugging port
 *   }
 * }
 * ```
 */
export abstract class BaseLauncher implements Services.ServiceInstance {
  protected globalOptions: NativeServiceGlobalOptions;
  protected projectRoot: string;

  constructor(globalOptions: NativeServiceGlobalOptions, _caps: unknown, config: Options.Testrunner) {
    this.globalOptions = globalOptions;
    this.projectRoot = globalOptions.rootDir || config.rootDir || process.cwd();
  }

  /**
   * WebdriverIO hook: Called before test suite starts
   * This is the main entry point for launcher logic
   *
   * @param config - Test runner configuration
   * @param capabilities - Test capabilities
   */
  async onPrepare(config: Options.Testrunner, capabilities: Capabilities.TestrunnerCapabilities): Promise<void> {
    // Validate configuration
    await this.validateConfig(config);

    // Prepare capabilities (framework-specific)
    await this.prepareCapabilities(config, capabilities as NativeServiceCapabilities);

    // Run any additional setup
    await this.onPrepareHook(config, capabilities as NativeServiceCapabilities);
  }

  /**
   * Validate test runner configuration
   * Can be overridden by subclasses for framework-specific validation
   *
   * @param config - Test runner configuration
   */
  protected async validateConfig(_config: Options.Testrunner): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for framework-specific validation
  }

  /**
   * Abstract method: Prepare capabilities for the test session
   * Framework-specific implementations must provide this logic
   *
   * This is where you would:
   * - Detect binary paths
   * - Set up debugging ports
   * - Configure Chrome/WebDriver options
   * - Apply platform-specific workarounds
   *
   * @param config - Test runner configuration
   * @param capabilities - Capabilities to prepare
   */
  protected abstract prepareCapabilities(
    config: Options.Testrunner,
    capabilities: NativeServiceCapabilities,
  ): Promise<void>;

  /**
   * Optional hook: Additional setup after capability preparation
   * Can be overridden by subclasses for custom initialization
   *
   * @param config - Test runner configuration
   * @param capabilities - Prepared capabilities
   */
  protected async onPrepareHook(_config: Options.Testrunner, _capabilities: NativeServiceCapabilities): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom initialization
  }

  /**
   * WebdriverIO hook: Called after all workers complete
   * Can be overridden for cleanup logic
   *
   * @param exitCode - Exit code from test run
   * @param config - Test runner configuration
   * @param capabilities - Test capabilities
   * @param results - Test results
   */
  async onComplete(
    _exitCode: number,
    _config: Omit<Options.Testrunner, 'capabilities'>,
    _capabilities: Capabilities.TestrunnerCapabilities,
    _results: unknown,
  ): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for cleanup
  }
}
