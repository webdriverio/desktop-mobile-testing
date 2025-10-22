import type { WindowHandle } from './types.js';
import type { WindowManager } from './WindowManager.js';

/**
 * Manages window state across multiple remote browser instances
 *
 * In multiremote scenarios, each browser instance may have its own windows
 * This class coordinates window management across all instances
 *
 * @example
 * ```typescript
 * const multiManager = new MultiRemoteWindowManager();
 *
 * // Register managers for each instance
 * multiManager.registerInstance('browserA', managerA);
 * multiManager.registerInstance('browserB', managerB);
 *
 * // Ensure all instances are focused on active windows
 * await multiManager.ensureAllActiveWindows();
 * ```
 */
export class MultiRemoteWindowManager {
  private instances: Map<string, WindowManager> = new Map();

  /**
   * Register a window manager for a multiremote instance
   *
   * @param instanceName - Name of the multiremote instance
   * @param manager - Window manager for this instance
   */
  registerInstance(instanceName: string, manager: WindowManager): void {
    this.instances.set(instanceName, manager);
  }

  /**
   * Unregister a window manager
   *
   * @param instanceName - Name of the instance to unregister
   */
  unregisterInstance(instanceName: string): void {
    this.instances.delete(instanceName);
  }

  /**
   * Get window manager for a specific instance
   *
   * @param instanceName - Name of the instance
   * @returns Window manager or undefined if not found
   */
  getInstanceManager(instanceName: string): WindowManager | undefined {
    return this.instances.get(instanceName);
  }

  /**
   * Get all registered instance names
   *
   * @returns Array of instance names
   */
  getInstanceNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Get current handle for a specific instance
   *
   * @param instanceName - Name of the instance
   * @returns Current window handle or undefined
   */
  getCurrentHandle(instanceName: string): WindowHandle | undefined {
    const manager = this.instances.get(instanceName);
    return manager?.getCurrentHandle();
  }

  /**
   * Update active window handles for all instances
   *
   * @returns Map of instance names to whether they were updated
   */
  async updateAllActiveHandles(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [instanceName, manager] of this.instances) {
      const updated = await manager.updateActiveHandle();
      results.set(instanceName, updated);
    }

    return results;
  }

  /**
   * Ensure all instances are focused on their active windows
   * Convenience method that updates all active handles
   *
   * @returns Total number of instances that had their handles updated
   */
  async ensureAllActiveWindows(): Promise<number> {
    const results = await this.updateAllActiveHandles();
    return Array.from(results.values()).filter((updated) => updated).length;
  }

  /**
   * Clear all registered instances
   */
  clear(): void {
    this.instances.clear();
  }

  /**
   * Get count of registered instances
   *
   * @returns Number of registered instances
   */
  get instanceCount(): number {
    return this.instances.size;
  }
}
