// Inlined here to avoid a circular build dependency: bundler builds native-utils,
// so native-utils cannot be imported by bundler at build time.
// The canonical implementation lives in @wdio/native-utils/src/package.ts.
import { readFileSync } from 'node:fs';
import type { NormalizedPackageJson, NormalizedReadResult } from '@wdio/native-types';
import { findUpSync } from 'find-up';

export type { NormalizedPackageJson, NormalizedReadResult };

export function readPackageUpSync(options: { cwd?: string } = {}): NormalizedReadResult | undefined {
  const filePath = findUpSync('package.json', { cwd: options.cwd || process.cwd() });
  if (!filePath) return undefined;
  return { packageJson: JSON.parse(readFileSync(filePath, 'utf-8')), path: filePath };
}
