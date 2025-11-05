/**
 * WebDriverIO Tauri Plugin - Frontend TypeScript/JavaScript API
 * Provides execute and mocking interfaces for testing
 */
import type { InvokeArgs } from '@tauri-apps/api/core';
declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke?: (cmd: string, args?: InvokeArgs) => Promise<unknown>;
      };
    };
    wdioTauri?: {
      execute: (script: string, args?: unknown[]) => Promise<unknown>;
      setMock: (command: string, config: unknown) => Promise<void>;
      getMock: (command: string) => Promise<unknown | null>;
      clearMocks: () => Promise<void>;
      resetMocks: () => Promise<void>;
      restoreMocks: () => Promise<void>;
    };
  }
}
/**
 * Execute JavaScript code in the frontend context with access to Tauri APIs
 * The script will receive the Tauri APIs object as the first argument
 * @param script - JavaScript code to execute (function string without first parameter)
 * @param args - Arguments to pass to the script (after the Tauri APIs object)
 * @returns Result of the script execution
 */
export declare function execute(script: string, args?: unknown[]): Promise<unknown>;
/**
 * Set a mock for a Tauri command
 * @param command - Command name to mock
 * @param config - Mock configuration
 */
export declare function setMock(command: string, config: unknown): Promise<void>;
/**
 * Get mock configuration for a command
 * @param command - Command name
 * @returns Mock configuration or null
 */
export declare function getMock(command: string): Promise<unknown | null>;
/**
 * Clear all mocks
 */
export declare function clearMocks(): Promise<void>;
/**
 * Reset all mocks
 */
export declare function resetMocks(): Promise<void>;
/**
 * Restore all mocks
 */
export declare function restoreMocks(): Promise<void>;
/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export declare function init(): void;
