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
      log?: {
        trace?: (message: string) => Promise<void>;
        debug?: (message: string) => Promise<void>;
        info?: (message: string) => Promise<void>;
        warn?: (message: string) => Promise<void>;
        error?: (message: string) => Promise<void>;
      };
      event?: {
        listen?: (event: string, callback: (event: { payload: unknown }) => void) => Promise<() => void>;
        emit?: (event: string, payload?: unknown) => Promise<void>;
      };
    };
    wdioTauri?: {
      execute: (cmd: string, args?: InvokeArgs) => Promise<unknown>;
      init: () => Promise<void>;
      waitForInit: () => Promise<void>;
      cleanupBackendLogListener?: () => void;
      cleanupFrontendLogListener?: () => void;
      cleanupInvokeInterception?: () => void;
      cleanupLogListeners: () => void;
      cleanupAll: () => void;
    };
    __native_spy__?: {
      fn: typeof import('@wdio/native-spy').fn;
    };
    __wdio_mocks__?: Record<string, unknown>;
  }
}
/**
 * Cleanup registry to manage timers and event listeners
 * Prevents memory leaks from retry loops and orphaned listeners
 */
declare class CleanupRegistry {
  private timers;
  private listeners;
  addTimer(id: number): void;
  clearTimers(): void;
  addListener(fn: () => void): void;
  cleanup(): void;
}
export declare const cleanupRegistry: CleanupRegistry;
/**
 * Execute JavaScript code in the frontend context with access to Tauri APIs
 * The script will receive the Tauri APIs object as the first argument
 * @param script - JavaScript code to execute (function string without first parameter)
 * @param args - Arguments to pass to the script (after the Tauri APIs object)
 * @returns Result of the script execution
 */
export declare function execute(script: string, args?: unknown[]): Promise<unknown>;
/**
 * Get the console forwarding setup code as a string
 * This can be injected into browser.execute() contexts
 */
export declare function getConsoleForwardingCode(): string;
/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export declare function init(): Promise<void>;
/**
 * Wait for plugin initialization to complete
 * This can be called by the service to ensure attachConsole() has completed
 */
export declare function waitForInit(): Promise<void>;
