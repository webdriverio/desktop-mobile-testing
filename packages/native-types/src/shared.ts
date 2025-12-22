import type { ChainablePromiseArray, ChainablePromiseElement } from 'webdriverio';

// ============================================================================
// Shared Base Types
// ============================================================================

export type Fn = (...args: unknown[]) => unknown;
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
export type AbstractFn = Fn | AsyncFn;

type $ = (selector: unknown) => ChainablePromiseElement;
type $$ = (selector: unknown) => ChainablePromiseArray;

type SelectorsBase = {
  $: $;
  $$: $$;
};

type BaseWithExecute = {
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  execute<T>(script: string | ((...args: unknown[]) => T), ...args: unknown[]): T;
  executeAsync(script: string | ((...args: unknown[]) => void), ...args: unknown[]): unknown;
};

type ElementBase = SelectorsBase & {
  parent: ElementBase | BaseWithExecute;
};

type BrowserBase = SelectorsBase & {
  addCommand<T extends boolean>(
    queryName: string,
    commandFn: (this: T extends true ? ElementBase : BrowserBase, ...args: unknown[]) => void,
    isElementCommand?: T,
  ): unknown;
};

export type { BaseWithExecute, BrowserBase, ElementBase, SelectorsBase };

// ============================================================================
// Shared Mock Infrastructure
// ============================================================================

/**
 * Mock result type - shared between Electron and Tauri mocking
 */
export enum MockResultType {
  Return = 'return',
  Throw = 'throw',
}

/**
 * Mock result - shared between Electron and Tauri mocking
 */
export type MockResult = {
  type: MockResultType;
  value: unknown;
};

/**
 * Mock context - shared between Electron and Tauri mocking
 */
export interface MockContext {
  /**
   * This is an array containing all arguments for each call. Each item of the array is the arguments of that call.
   */
  calls: unknown[][];
  /**
   * The order of mock invocation. This returns an array of numbers that are shared between all defined mocks. Will return an empty array if the mock was never invoked.
   */
  invocationCallOrder: number[];
  /**
   * This is an array containing all values that were returned from the mock. Each item of the array is an object with the properties type and value.
   */
  results: MockResult[];
  /**
   * This contains the arguments of the last call. If the mock wasn't called, it will return `undefined`.
   */
  lastCall: unknown;
}

/**
 * Override types for mock methods
 */
export type MockOverride =
  | 'mockImplementation'
  | 'mockImplementationOnce'
  | 'mockReturnValue'
  | 'mockReturnValueOnce'
  | 'mockResolvedValue'
  | 'mockResolvedValueOnce'
  | 'mockRejectedValue'
  | 'mockRejectedValueOnce'
  | 'mockClear'
  | 'mockReset'
  | 'mockReturnThis'
  | 'mockName'
  | 'withImplementation'
  | 'mock';
