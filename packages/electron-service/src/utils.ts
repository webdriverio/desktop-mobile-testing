import type { ExecuteOpts } from '@wdio/native-types';

/**
 * Check if a command is an internal command by examining the last argument.
 * Internal commands are marked with `{ internal: true }` and should be
 * excluded from certain processing like mock updates and window focus checks.
 */
export function isInternalCommand(args: unknown[]): boolean {
  return Boolean((args[args.length - 1] as ExecuteOpts | undefined)?.internal);
}
