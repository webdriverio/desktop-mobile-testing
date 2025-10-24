#!/usr/bin/env tsx
/**
 * Script to test the wdio-electron-service package in the package test apps
 * Usage: pnpx tsx scripts/test-package.ts [--package=<package-name>] [--skip-build]
 *
 * Examples:
 * pnpx tsx scripts/test-package.ts
 * pnpx tsx scripts/test-package.ts --package=builder-app
 * pnpx tsx scripts/test-package.ts --package=forge-app --skip-build
 * pnpx tsx scripts/test-package.ts --package=script-app
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

// Add global error handlers to catch silent failures
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Fix Windows path handling for fileURLToPath
const __filename = (() => {
  try {
    const url = import.meta.url;
    return process.platform === 'win32' ? fileURLToPath(url) : fileURLToPath(url);
  } catch (_error) {
    return process.argv[1];
  }
})();

const __dirname = dirname(__filename);
const rootDir = normalize(join(__dirname, '..'));
const serviceDir = normalize(join(rootDir, 'packages', 'electron-service'));

interface TestOptions {
  package?: string;
  skipBuild?: boolean;
}

function log(message: string) {
  console.log(`🔧 ${message}`);
}

function execCommand(command: string, cwd: string, description: string) {
  log(`${description}...`);

  try {
    execSync(command, {
      cwd: normalize(cwd),
      stdio: 'inherit',
      encoding: 'utf-8',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
    log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`);
    if (error instanceof Error) {
      console.error(error.message);
      if ('stderr' in error && error.stderr) {
        console.error(error.stderr);
      }
    }
    throw error;
  }
}

async function buildAndPackService(): Promise<{
  servicePath: string;
  utilsPath: string;
  typesPath: string;
  cdpBridgePath: string;
}> {
  log('Building and packing wdio-electron-service and dependencies...');

  try {
    // Build all packages
    execCommand('pnpm build', rootDir, 'Building all packages');

    // Pack the dependencies first
    const utilsDir = normalize(join(rootDir, 'packages', 'electron-utils'));
    const typesDir = normalize(join(rootDir, 'packages', 'electron-types'));
    const cdpBridgeDir = normalize(join(rootDir, 'packages', 'electron-cdp-bridge'));

    if (!existsSync(utilsDir)) {
      throw new Error(`Utils directory does not exist: ${utilsDir}`);
    }

    if (!existsSync(typesDir)) {
      throw new Error(`Types directory does not exist: ${typesDir}`);
    }

    if (!existsSync(cdpBridgeDir)) {
      throw new Error(`CDP Bridge directory does not exist: ${cdpBridgeDir}`);
    }

    execCommand('pnpm pack', utilsDir, 'Packing @wdio/electron-utils');
    execCommand('pnpm pack', typesDir, 'Packing @wdio/electron-types');
    execCommand('pnpm pack', cdpBridgeDir, 'Packing @wdio/electron-cdp-bridge');

    // Pack the service
    execCommand('pnpm pack', serviceDir, 'Packing wdio-electron-service');

    // Find the generated .tgz files
    const findTgzFile = (dir: string, prefix: string): string => {
      const files = readdirSync(dir);
      const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
      if (!tgzFile) {
        throw new Error(`Could not find ${prefix} .tgz file in ${dir}`);
      }
      return normalize(join(dir, tgzFile));
    };

    const servicePath = findTgzFile(serviceDir, 'wdio-electron-service-');
    const utilsPath = findTgzFile(utilsDir, 'wdio-electron-utils-');
    const typesPath = findTgzFile(typesDir, 'wdio-electron-types-');
    const cdpBridgePath = findTgzFile(cdpBridgeDir, 'wdio-electron-cdp-bridge-');

    log(`📦 Packages packed:`);
    log(`   Service: ${servicePath}`);
    log(`   Utils: ${utilsPath}`);
    log(`   Types: ${typesPath}`);
    log(`   CDP Bridge: ${cdpBridgePath}`);

    return { servicePath, utilsPath, typesPath, cdpBridgePath };
  } catch (error) {
    console.error('❌ Failed in buildAndPackService:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  }
}

async function testExample(
  packagePath: string,
  packages: { servicePath: string; utilsPath: string; typesPath: string; cdpBridgePath: string },
) {
  const packageName = packagePath.split(/[/\\]/).pop();
  if (!packageName) {
    throw new Error(`Invalid package path: ${packagePath}`);
  }

  log(`Testing package: ${packageName}`);

  if (!existsSync(packagePath)) {
    throw new Error(`Package not found: ${packagePath}`);
  }

  // Create isolated test environment to avoid pnpm hoisting issues
  const tempDir = normalize(join(tmpdir(), `wdio-electron-test-${Date.now()}`));
  const packageDir = normalize(join(tempDir, packageName));

  try {
    log(`Creating isolated test environment at ${tempDir}`);
    mkdirSync(tempDir, { recursive: true });
    cpSync(packagePath, packageDir, { recursive: true });

    // Create .pnpmrc to prevent hoisting and ensure proper resolution
    const pnpmrcPath = join(packageDir, '.pnpmrc');
    writeFileSync(pnpmrcPath, 'hoist=false\nnode-linker=isolated\n');

    // Add pnpm overrides to package.json to force local package versions
    const packageJsonPath = join(packageDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error(`package.json not found at ${packageJsonPath}`);
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    packageJson.pnpm = {
      ...packageJson.pnpm,
      overrides: {
        '@wdio/electron-service': `file:${packages.servicePath}`,
        '@wdio/electron-utils': `file:${packages.utilsPath}`,
        '@wdio/electron-types': `file:${packages.typesPath}`,
        '@wdio/electron-cdp-bridge': `file:${packages.cdpBridgePath}`,
      },
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Install all dependencies with pnpm
    execCommand('pnpm install', packageDir, `Installing dependencies for ${packageName}`);

    // Install local packages
    const addCommand = `pnpm add ${packages.typesPath} ${packages.utilsPath} ${packages.cdpBridgePath} ${packages.servicePath}`;
    execCommand(addCommand, packageDir, `Installing local packages for ${packageName}`);

    // Build the app if needed
    if (
      packageJson.scripts?.build &&
      (packageName.includes('builder') || packageName.includes('forge') || packageName.includes('script'))
    ) {
      execCommand('pnpm build', packageDir, `Building ${packageName} app`);
    }

    execCommand('pnpm test', packageDir, `Running tests for ${packageName}`);

    log(`✅ ${packageName} tests passed!`);
  } catch (error) {
    console.error(`❌ Error testing ${packageName}:`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw error;
  } finally {
    // Clean up isolated environment
    if (existsSync(tempDir)) {
      log(`Cleaning up isolated test environment`);
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch (_cleanupError) {
        console.error(`Failed to clean up temp directory: ${tempDir}`);
      }
    }
  }
}

async function main() {
  try {
    const args = process.argv.slice(2);
    const options: TestOptions = {
      package: args.find((arg) => arg.startsWith('--package='))?.split('=')[1],
      skipBuild: args.includes('--skip-build'),
    };

    // Build and pack service (unless skipped)
    let packages: { servicePath: string; utilsPath: string; typesPath: string; cdpBridgePath: string };
    if (options.skipBuild) {
      // Find existing .tgz files
      const findTgzFile = (dir: string, prefix: string): string => {
        const files = readdirSync(dir);
        const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
        if (!tgzFile) {
          throw new Error(`No ${prefix} .tgz file found. Run without --skip-build first.`);
        }
        return normalize(join(dir, tgzFile));
      };

      const utilsDir = normalize(join(rootDir, 'packages', 'electron-utils'));
      const typesDir = normalize(join(rootDir, 'packages', 'electron-types'));
      const cdpBridgeDir = normalize(join(rootDir, 'packages', 'electron-cdp-bridge'));

      packages = {
        servicePath: findTgzFile(serviceDir, 'wdio-electron-service-'),
        utilsPath: findTgzFile(utilsDir, 'wdio-electron-utils-'),
        typesPath: findTgzFile(typesDir, 'wdio-electron-types-'),
        cdpBridgePath: findTgzFile(cdpBridgeDir, 'wdio-electron-cdp-bridge-'),
      };
      log(`📦 Using existing packages:`);
      log(`   Service: ${packages.servicePath}`);
      log(`   Utils: ${packages.utilsPath}`);
      log(`   Types: ${packages.typesPath}`);
      log(`   CDP Bridge: ${packages.cdpBridgePath}`);
    } else {
      packages = await buildAndPackService();
    }

    // Find packages to test
    const packagesDir = normalize(join(rootDir, 'fixtures', 'package-tests'));
    if (!existsSync(packagesDir)) {
      throw new Error(`Packages directory not found: ${packagesDir}`);
    }

    const packages = readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => !name.startsWith('.'));

    // Filter packages if specific one requested
    const packagesToTest = options.package ? packages.filter((name) => name === options.package) : packages;

    if (packagesToTest.length === 0) {
      if (options.package) {
        throw new Error(`Package '${options.package}' not found. Available: ${packages.join(', ')}`);
      } else {
        throw new Error(`No packages found in ${packagesDir}`);
      }
    }

    log(`Found packages to test: ${packagesToTest.join(', ')}`);

    // Test each package
    for (const packageName of packagesToTest) {
      const packagePath = normalize(join(packagesDir, packageName));

      // Skip if it's just a placeholder (no package.json)
      const packageJsonPath = join(packagePath, 'package.json');
      if (!existsSync(packageJsonPath)) {
        log(`⏭️  Skipping ${packageName} (no package.json found)`);
        continue;
      }

      await testExample(packagePath, packages);
    }

    log(`🎉 All package tests completed successfully!`);
  } catch (error) {
    console.error('❌ Package testing failed:');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Fix main module detection for Windows
const isMainModule = (() => {
  try {
    const scriptPath = normalize(process.argv[1]);
    const scriptUrl =
      process.platform === 'win32' ? `file:///${scriptPath.replace(/\\/g, '/')}` : `file://${scriptPath}`;
    return import.meta.url === scriptUrl;
  } catch (_error) {
    return __filename === process.argv[1] || __filename === normalize(process.argv[1]);
  }
})();

if (isMainModule) {
  main().catch((error) => {
    console.error('❌ Unhandled error in main:');
    console.error(error);
    process.exit(1);
  });
}
