/**
 * Type definitions for window management
 */

/**
 * Generic window handle (string identifier for a window/target)
 */
export type WindowHandle = string;

/**
 * Window information
 */
export interface WindowInfo {
  handle: WindowHandle;
  type: string;
  url?: string;
  title?: string;
}

/**
 * Result of window operation
 */
export interface WindowOperationResult {
  success: boolean;
  handle?: WindowHandle;
  error?: string;
}

/**
 * Options for window focus operations
 */
export interface WindowFocusOptions {
  /**
   * Whether to force focus even if already focused
   */
  force?: boolean;

  /**
   * Timeout for focus operation (ms)
   */
  timeout?: number;
}
