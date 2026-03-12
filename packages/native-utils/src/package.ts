import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { cwd } from 'node:process';
import type { NormalizedPackageJson, NormalizedReadResult, ReadPackageUpOptions } from '@wdio/native-types';
import { findUp, findUpSync } from 'find-up';

export type { NormalizedPackageJson, NormalizedReadResult, ReadPackageUpOptions };

export async function readPackageUp(options: ReadPackageUpOptions = {}): Promise<NormalizedReadResult | undefined> {
  const cwdPath = typeof options.cwd === 'string' ? options.cwd : options.cwd?.pathname || cwd();
  const filePath = await findUp('package.json', { cwd: cwdPath });
  if (!filePath) {
    return undefined;
  }

  const content = await readFile(filePath, 'utf-8');
  const packageJson = JSON.parse(content) as NormalizedPackageJson;

  return {
    packageJson,
    path: filePath,
  };
}

export function readPackageUpSync(options: ReadPackageUpOptions = {}): NormalizedReadResult | undefined {
  const cwdPath = typeof options.cwd === 'string' ? options.cwd : options.cwd?.pathname || cwd();
  const filePath = findUpSync('package.json', { cwd: cwdPath });
  if (!filePath) {
    return undefined;
  }

  const content = readFileSync(filePath, 'utf-8');
  const packageJson = JSON.parse(content) as NormalizedPackageJson;

  return {
    packageJson,
    path: filePath,
  };
}
