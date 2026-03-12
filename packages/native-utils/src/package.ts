import type { NormalizedReadResult } from 'read-package-up';

export async function readPackageUp(options: { cwd: string }): Promise<NormalizedReadResult | undefined> {
  const { readPackageUp: readPkg } = await import('read-package-up');
  return readPkg(options);
}
