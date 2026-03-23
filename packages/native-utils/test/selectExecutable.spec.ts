import assert from 'node:assert';
import fs from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { selectExecutable, validateBinaryPaths } from '../src/selectExecutable.js';
import { mockBinaryPath } from './testUtils.js';

/**
 * Mock the file system promises module to control file access checks
 */
vi.mock('node:fs/promises', async (importActual) => {
  const actual = await importActual<typeof import('node:fs/promises')>();
  return {
    default: {
      ...actual,
      access: vi.fn(),
    },
  };
});

vi.mock('../src/log.js', () => import('./__mock__/log.js'));

/**
 * Mock the binary path generator classes and utilities
 */
vi.mock('../../src/binary/binary', () => {
  return {
    ABinaryPathGenerator: vi.fn(),
    ExecutableBinaryPath: vi.fn(),
  };
});

vi.mock('../../src/binary/forge', () => {
  return {
    ForgeBinaryPathGenerator: vi.fn(),
    isForgeInfo: vi.fn(),
  };
});

vi.mock('../../src/binary/builder', () => {
  return {
    BuilderBinaryPathGenerator: vi.fn(),
    isBuilderInfo: vi.fn(),
  };
});

describe('selectExecutable', () => {
  it('should select first executable when multiple binaries are detected', async () => {
    const executableBinaryPaths = [
      '/path/to/dist/mac-arm64/my-app.app/Contents/MacOS/my-app',
      '/path/to/dist/mac-ia32/my-app.app/Contents/MacOS/my-app',
    ];
    mockBinaryPath(executableBinaryPaths);

    const result = await selectExecutable(executableBinaryPaths);

    expect(result).toBe(executableBinaryPaths[0]);
    const { createLogger } = await import('./__mock__/log.js');
    const mockLogger = createLogger();
    expect(mockLogger.info).toHaveBeenLastCalledWith(
      expect.stringMatching(/Detected multiple app binaries, using the first one:/),
    );
  });

  it('should throw error when no executable binary is found', async () => {
    // Create a proper ENOENT error for the mock
    const enoentError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    vi.mocked(fs.access).mockRejectedValue(enoentError);

    await expect(selectExecutable(['/path/to/dist'])).rejects.toThrowError('No executable binary found, checked:');
  });

  it('should report EACCES error with PERMISSION_DENIED type', async () => {
    const eaccesError = new Error('EACCES: permission denied') as NodeJS.ErrnoException;
    eaccesError.code = 'EACCES';
    vi.mocked(fs.access).mockRejectedValue(eaccesError);

    const result = await validateBinaryPaths(['/path/to/binary']);

    assert(!result.ok);
    expect(result.error.attempts).toHaveLength(1);
    expect(result.error.attempts[0].valid).toBe(false);
    expect(result.error.attempts[0].error?.type).toBe('PERMISSION_DENIED');
    expect(result.error.attempts[0].error?.code).toBe('EACCES');
  });

  it('should report EISDIR error with IS_DIRECTORY type', async () => {
    const eisdirError = new Error('EISDIR: illegal operation on a directory') as NodeJS.ErrnoException;
    eisdirError.code = 'EISDIR';
    vi.mocked(fs.access).mockRejectedValue(eisdirError);

    const result = await validateBinaryPaths(['/path/to/directory']);

    assert(!result.ok);
    expect(result.error.attempts).toHaveLength(1);
    expect(result.error.attempts[0].valid).toBe(false);
    expect(result.error.attempts[0].error?.type).toBe('IS_DIRECTORY');
    expect(result.error.attempts[0].error?.code).toBe('EISDIR');
  });

  it('should report ENOENT error with FILE_NOT_FOUND type', async () => {
    const enoentError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';
    vi.mocked(fs.access).mockRejectedValue(enoentError);

    const result = await validateBinaryPaths(['/nonexistent/path']);

    assert(!result.ok);
    expect(result.error.attempts).toHaveLength(1);
    expect(result.error.attempts[0].error?.type).toBe('FILE_NOT_FOUND');
    expect(result.error.attempts[0].error?.code).toBe('ENOENT');
  });

  it('should report generic access error for unknown error codes', async () => {
    const genericError = new Error('some other error') as NodeJS.ErrnoException;
    genericError.code = 'EUNKNOWN';
    vi.mocked(fs.access).mockRejectedValue(genericError);

    const result = await validateBinaryPaths(['/path/to/binary']);

    assert(!result.ok);
    expect(result.error.attempts[0].error?.type).toBe('ACCESS_ERROR');
  });

  it('should report NOT_EXECUTABLE for permission-related error messages', async () => {
    const permError = new Error('not executable') as NodeJS.ErrnoException;
    vi.mocked(fs.access).mockRejectedValue(permError);

    const result = await validateBinaryPaths(['/path/to/binary']);

    assert(!result.ok);
    expect(result.error.attempts[0].error?.type).toBe('NOT_EXECUTABLE');
  });

  it('should handle error without message property via String() fallback', async () => {
    const errorWithoutMessage = { name: 'CustomError' } as unknown as Error;
    Object.defineProperty(errorWithoutMessage, 'message', { value: '', writable: true });
    vi.mocked(fs.access).mockRejectedValue(errorWithoutMessage);

    const result = await validateBinaryPaths(['/path/to/binary']);

    assert(!result.ok);
    expect(result.error.attempts[0].error?.type).toBe('ACCESS_ERROR');
  });

  it('should return error result for empty paths array', async () => {
    const result = await validateBinaryPaths([]);

    assert(!result.ok);
    expect(result.error.attempts).toHaveLength(0);
  });

  it('should return first valid path when some paths fail', async () => {
    let callCount = 0;
    vi.mocked(fs.access).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
      // Second call succeeds
    });

    const result = await validateBinaryPaths(['/bad/path', '/good/path']);

    assert(result.ok);
    expect(result.value.validPath).toBe('/good/path');
    expect(result.value.attempts).toHaveLength(2);
    expect(result.value.attempts[0].valid).toBe(false);
    expect(result.value.attempts[1].valid).toBe(true);
  });
});
