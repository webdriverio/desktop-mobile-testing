import type { ExecuteOpts } from '@wdio/native-types';

export function isInternalCommand(args: unknown[]): boolean {
  return Boolean((args[args.length - 1] as ExecuteOpts | undefined)?.internal);
}
