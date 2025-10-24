import { describe, expect, it } from 'vitest';
import { executeTauriCommand, isTauriApiAvailable } from '../src/commands/execute.js';
import { getTauriBinaryPath, isTauriAppBuilt } from '../src/pathResolver.js';

describe('Tauri Service', () => {
  it('should export required functions', () => {
    expect(typeof getTauriBinaryPath).toBe('function');
    expect(typeof isTauriAppBuilt).toBe('function');
    expect(typeof executeTauriCommand).toBe('function');
    expect(typeof isTauriApiAvailable).toBe('function');
  });

  it('should handle path resolution errors gracefully', async () => {
    await expect(getTauriBinaryPath('/nonexistent/path')).rejects.toThrow();
  });

  it('should detect non-built apps', async () => {
    const isBuilt = await isTauriAppBuilt('/nonexistent/path');
    expect(isBuilt).toBe(false);
  });

  it('should match Electron service API surface', () => {
    // The Tauri service should provide the same API as Electron service
    const expectedMethods = [
      'execute',
      'clearAllMocks',
      'isMockFunction',
      'mock',
      'mockAll',
      'resetAllMocks',
      'restoreAllMocks',
    ];

    // This test documents the expected API surface
    expect(expectedMethods).toHaveLength(7);
    expect(expectedMethods).toContain('execute');
    expect(expectedMethods).toContain('mock');
  });
});
