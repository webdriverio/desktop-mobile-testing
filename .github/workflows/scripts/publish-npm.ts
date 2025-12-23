#!/usr/bin/env node
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
}

// Execute a command and return its output
function runCommand(command: string) {
  console.log(`Executing: ${command}`);
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit',
      maxBuffer: 10 * 1024 * 1024,
    });
    return output;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    throw error;
  }
}

// Read package.json from a given path
function readPackageJson(pkgPath: string): PackageJson | undefined {
  try {
    const content = fs.readFileSync(path.resolve(pkgPath), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading or parsing ${pkgPath}:`, (error as Error).message);
    return undefined;
  }
}

async function main() {
  const packageList = process.env.INPUT_PACKAGE_LIST || '';
  const npmTag = process.env.INPUT_NPM_TAG || 'latest';
  const dryRun = process.env.INPUT_DRY_RUN === 'true';
  const workspaceRoot = process.env.GITHUB_WORKSPACE || '.';

  if (!packageList) {
    console.error('Error: INPUT_PACKAGE_LIST is required');
    process.exit(1);
  }

  console.log(`NPM Tag: ${npmTag}`);
  console.log(`Dry Run: ${dryRun}`);
  console.log(`Package List: ${packageList}`);

  process.chdir(workspaceRoot);

  // Parse package list
  const packages = packageList
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  console.log(`\n========== PUBLISHING ${packages.length} PACKAGES ==========\n`);

  const published: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const scopedName of packages) {
    console.log(`\n📦 Processing: ${scopedName}`);

    // Find package directory
    const packagesDir = path.join(workspaceRoot, 'packages');
    const packageDirs = fs.readdirSync(packagesDir);

    let packageDir: string | undefined;
    for (const dir of packageDirs) {
      const pkgJsonPath = path.join(packagesDir, dir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = readPackageJson(pkgJsonPath);
        if (pkgJson?.name === scopedName) {
          packageDir = dir;
          break;
        }
      }
    }

    if (!packageDir) {
      console.error(`   ❌ Could not find package directory for ${scopedName}`);
      failed.push(scopedName);
      continue;
    }

    const pkgJsonPath = path.join(packagesDir, packageDir, 'package.json');
    const pkgJson = readPackageJson(pkgJsonPath);

    if (!pkgJson) {
      console.error(`   ❌ Could not read package.json for ${scopedName}`);
      failed.push(scopedName);
      continue;
    }

    // Skip private packages
    if (pkgJson.private) {
      console.log(`   ⏭️  Skipping private package`);
      skipped.push(scopedName);
      continue;
    }

    console.log(`   Version: ${pkgJson.version}`);
    console.log(`   Tag: ${npmTag}`);

    try {
      if (dryRun) {
        console.log(`   🔍 Dry run - would publish to NPM with tag "${npmTag}"`);
        published.push(scopedName);
      } else {
        // Use pnpm publish with the specific package filter
        const publishCmd = `pnpm --filter ${scopedName} publish --tag ${npmTag} --access public --no-git-checks`;
        runCommand(publishCmd);
        console.log(`   ✅ Published successfully`);
        published.push(scopedName);
      }
    } catch (error) {
      console.error(`   ❌ Failed to publish: ${(error as Error).message}`);
      failed.push(scopedName);
    }
  }

  console.log('\n========== PUBLICATION SUMMARY ==========');
  console.log(`✅ Published: ${published.length}`);
  if (published.length > 0) {
    published.forEach((pkg) => {
      console.log(`   - ${pkg}`);
    });
  }

  if (skipped.length > 0) {
    console.log(`⏭️  Skipped: ${skipped.length}`);
    skipped.forEach((pkg) => {
      console.log(`   - ${pkg}`);
    });
  }

  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}`);
    failed.forEach((pkg) => {
      console.log(`   - ${pkg}`);
    });
  }
  console.log('=========================================\n');

  if (failed.length > 0) {
    console.error('Some packages failed to publish');
    process.exit(1);
  }

  console.log('All packages published successfully!');
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
