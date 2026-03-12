import type { BinaryPathResult, PathValidationAttempt } from '@wdio/native-types';

interface BinaryPathResultOptions {
  success: boolean;
  binaryPath?: string;
  paths?: string[];
  attempts?: PathValidationAttempt[];
}

export function createBinaryPathResult(options: BinaryPathResultOptions): BinaryPathResult {
  if (options.success) {
    const binaryPath = options.binaryPath ?? '';
    return {
      ok: true,
      value: {
        binaryPath,
        pathGeneration: {
          ok: true,
          value: {
            paths: options.paths || [binaryPath],
          },
        },
        pathValidation: {
          ok: true,
          value: {
            validPath: binaryPath,
            attempts: options.attempts || [{ path: binaryPath, valid: true }],
          },
        },
      },
    };
  }

  return {
    ok: false,
    error: {
      pathGeneration: {
        ok: !!options.paths,
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
