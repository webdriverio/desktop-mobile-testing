import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { cwd } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { NormalizedPackageJson, NormalizedReadResult, ReadPackageUpOptions } from '@wdio/native-types';
import { findUp, findUpSync } from 'find-up-simple';

export type { NormalizedPackageJson, NormalizedReadResult, ReadPackageUpOptions };

export async function readPackageUp(options: ReadPackageUpOptions = {}): Promise<NormalizedReadResult | undefined> {
  let cwdPath: string;
  if (typeof options.cwd === 'string') {
    cwdPath = options.cwd;
  } else if (
    options.cwd &&
    typeof options.cwd === 'object' &&
    'pathname' in options.cwd &&
    !(options.cwd instanceof URL)
  ) {
    cwdPath = (options.cwd as { pathname: string }).pathname;
  } else if (options.cwd instanceof URL) {
    cwdPath = fileURLToPath(options.cwd);
  } else {
    cwdPath = cwd();
  }

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
  let cwdPath: string;
  if (typeof options.cwd === 'string') {
    cwdPath = options.cwd;
  } else if (
    options.cwd &&
    typeof options.cwd === 'object' &&
    'pathname' in options.cwd &&
    !(options.cwd instanceof URL)
  ) {
    cwdPath = (options.cwd as { pathname: string }).pathname;
  } else if (options.cwd instanceof URL) {
    cwdPath = fileURLToPath(options.cwd);
  } else {
    cwdPath = cwd();
  }

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
