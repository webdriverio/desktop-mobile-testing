/**
 * Type declarations for window.wdioTauri
 */

export interface WdioTauriAPI {
  execute(script: string, args?: unknown[]): Promise<unknown>;
  setMock(command: string, config: unknown): Promise<void>;
  getMock(command: string): Promise<unknown | null>;
  clearMocks(): Promise<void>;
  resetMocks(): Promise<void>;
  restoreMocks(): Promise<void>;
}

declare global {
  interface Window {
    wdioTauri?: WdioTauriAPI;
  }
}

export function execute(script: string, args?: unknown[]): Promise<unknown>;
export function setMock(command: string, config: unknown): Promise<void>;
export function getMock(command: string): Promise<unknown | null>;
export function clearMocks(): Promise<void>;
export function resetMocks(): Promise<void>;
export function restoreMocks(): Promise<void>;
export function init(): void;
