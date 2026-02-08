/**
 * Type declarations for window.wdioTauri
 */

export interface WdioTauriAPI {
  execute(script: string, ...args: unknown[]): Promise<unknown>;
  waitForInit(): Promise<void>;
  cleanupBackendLogListener?: () => void;
  cleanupFrontendLogListener?: () => void;
  cleanupInvokeInterception?: () => void;
  cleanupLogListeners: () => void;
  cleanupAll: () => void;
}

declare global {
  interface Window {
    wdioTauri?: WdioTauriAPI;
  }
}

export function execute(script: string, ...args: unknown[]): Promise<unknown>;
export function getConsoleForwardingCode(): string;
export function init(): Promise<void>;
export function waitForInit(): Promise<void>;
