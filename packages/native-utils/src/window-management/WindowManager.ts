import type { WindowHandle, WindowInfo } from './types.js';

/**
 * Abstract base class for window management
 *
 * Provides protocol-agnostic window handle tracking and focus management
 * Works with any debugging protocol (CDP, Flutter DevTools, etc.)
 *
 * @example
 * ```typescript
 * class PuppeteerWindowManager extends WindowManager {
 *   protected async getAvailableWindows(): Promise<WindowInfo[]> {
 *     const targets = this.puppeteer.targets()
 *       .filter(target => target.type() === 'page');
 *     return targets.map(t => ({
 *       handle: t._targetId,
 *       type: 'page',
 *       url: t.url()
 *     }));
 *   }
 * }
 * ```
 */
export abstract class WindowManager {
  private currentHandle?: WindowHandle;

  /**
   * Get the current active window handle
   *
   * @returns Current window handle or undefined if not set
   */
  getCurrentHandle(): WindowHandle | undefined {
    return this.currentHandle;
  }

  /**
   * Set the current active window handle
   *
   * @param handle - Window handle to set as current
   */
  setCurrentHandle(handle: WindowHandle | undefined): void {
    this.currentHandle = handle;
  }

  /**
   * Get the active window handle
   *
   * Algorithm:
   * 1. Get all available windows
   * 2. If current handle is still valid, keep it
   * 3. Otherwise, return first available window
   *
   * @returns Active window handle or undefined if no windows available
   */
  async getActiveHandle(): Promise<WindowHandle | undefined> {
    const windows = await this.getAvailableWindows();

    // No windows available
    if (windows.length === 0) {
      return undefined;
    }

    // Extract handles from windows
    const handles = windows.map((w) => w.handle);

    // If we have a current window handle and it's still valid, keep using it
    if (this.currentHandle && handles.includes(this.currentHandle)) {
      return this.currentHandle;
    }

    // Otherwise return first available window handle
    return handles[0];
  }

  /**
   * Update the active window handle
   * Checks if the current handle is still valid, otherwise switches to first available
   *
   * @returns True if handle was updated, false otherwise
   */
  async updateActiveHandle(): Promise<boolean> {
    const oldHandle = this.currentHandle;
    const newHandle = await this.getActiveHandle();

    if (newHandle && newHandle !== oldHandle) {
      this.currentHandle = newHandle;
      return true;
    }

    return false;
  }

  /**
   * Check if a window handle is valid (exists in available windows)
   *
   * @param handle - Window handle to validate
   * @returns True if handle is valid
   */
  async isHandleValid(handle: WindowHandle): Promise<boolean> {
    const windows = await this.getAvailableWindows();
    return windows.some((w) => w.handle === handle);
  }

  /**
   * Get window information by handle
   *
   * @param handle - Window handle
   * @returns Window information or undefined if not found
   */
  async getWindowInfo(handle: WindowHandle): Promise<WindowInfo | undefined> {
    const windows = await this.getAvailableWindows();
    return windows.find((w) => w.handle === handle);
  }

  /**
   * Abstract method: Get all available windows
   * Framework-specific implementations must provide this logic
   *
   * @returns Array of available windows with their information
   */
  protected abstract getAvailableWindows(): Promise<WindowInfo[]>;

  /**
   * Optional hook: Custom logic after handle update
   * Can be overridden by subclasses for framework-specific actions
   *
   * @param oldHandle - Previous window handle
   * @param newHandle - New window handle
   */
  protected async onHandleUpdate(_oldHandle: WindowHandle | undefined, _newHandle: WindowHandle): Promise<void> {
    // Default implementation does nothing
    // Subclasses can override for custom logic
  }
}
