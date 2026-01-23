/**
 * @wdio/native-spy - Minimal mock function implementation
 *
 * This package provides a lightweight mock/spy implementation for use in
 * Electron and Tauri desktop testing scenarios where @vitest/spy cannot
 * be bundled directly into the application context.
 */

export { createMock as fn } from './mock.js';
export type { Mock, MockContext, MockResult, MockResultType, MockState } from './types.js';
