import type { BinaryPathResult } from '@wdio/native-types';

/**
 * Test helper to create properly typed BinaryPathResult mocks
 * Uses the new `ok` pattern instead of the deprecated `success` pattern
 */
export function createBinaryPathResult(options: {
  success: boolean;
  binaryPath?: string;
  paths?: string[];
  attempts?: Array<{ path: string; valid: boolean; error?: { type: string; message: string; code?: string } }>;
}): BinaryPathResult {
  if (options.success) {
    return {
      ok: true,
      value: {
        binaryPath: options.binaryPath!,
        pathGeneration: {
          ok: true,
          value: {
            paths: options.paths || [options.binaryPath!],
          },
        },
        pathValidation: {
          ok: true,
          value: {
            validPath: options.binaryPath!,
            attempts: options.attempts || [{ path: options.binaryPath!, valid: true }],
          },
        },
      },
    };
  }

  return {
    ok: false,
    error: {
      pathGeneration: {
        ok: options.paths ? true : false,
        value: options.paths ? { paths: options.paths } : undefined,
        error: !options.paths ? { errors: [{ type: 'CONFIG_INVALID', message: 'No paths generated' }] } : undefined,
      } as import('@wdio/native-types').PathGenerationResult,
      pathValidation: {
        ok: false,
        error: {
          attempts: options.attempts || [],
        },
      } as import('@wdio/native-types').PathValidationResult,
    },
  };
}
