import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readPackageUp, readPackageUpSync } from '../src/package.js';

describe('readPackageUp', () => {
  const testDir = path.resolve(process.cwd(), 'test-tmp-package-up');
  const pkgJsonPath = path.join(testDir, 'package.json');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      pkgJsonPath,
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should find package.json in parent directories', async () => {
    const result = await readPackageUp({ cwd: testDir });
    expect(result).toBeDefined();
    expect(result?.packageJson.name).toBe('test-package');
    expect(result?.packageJson.version).toBe('1.0.0');
    expect(result?.path).toBe(pkgJsonPath);
  });

  it('should return undefined when package.json is not found', async () => {
    const result = await readPackageUp({ cwd: '/' });
    expect(result).toBeUndefined();
  });
});

describe('readPackageUpSync', () => {
  const testDir = path.resolve(process.cwd(), 'test-tmp-package-up-sync');
  const pkgJsonPath = path.join(testDir, 'package.json');

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(
      pkgJsonPath,
      JSON.stringify({
        name: 'test-package-sync',
        version: '2.0.0',
      }),
    );
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should find package.json synchronously', () => {
    const result = readPackageUpSync({ cwd: testDir });
    expect(result).toBeDefined();
    expect(result?.packageJson.name).toBe('test-package-sync');
    expect(result?.packageJson.version).toBe('2.0.0');
    expect(result?.path).toBe(pkgJsonPath);
  });

  it('should return undefined when package.json is not found', () => {
    const result = readPackageUpSync({ cwd: '/' });
    expect(result).toBeUndefined();
  });
});
