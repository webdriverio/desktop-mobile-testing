#!/usr/bin/env tsx
/**
 * Script to test the wdio-electron-service and wdio-tauri-service packages in the package test apps
 * Usage: pnpx tsx scripts/test-package.ts [--package=<package-name>] [--service=<electron|tauri|both>] [--skip-build]
 *
 * Examples:
 * pnpx tsx scripts/test-package.ts
 * pnpx tsx scripts/test-package.ts --service=electron
 * pnpx tsx scripts/test-package.ts --service=tauri
 * pnpx tsx scripts/test-package.ts --package=electron-builder-app
 * pnpx tsx scripts/test-package.ts --package=tauri-app --skip-build
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

interface TestOptions {
  package?: string;
  skipBuild?: boolean;
  service?: 'electron' | 'tauri' | 'both';
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

async function buildAndPackService(service: 'electron' | 'tauri' | 'both' = 'both'): Promise<{
  electronServicePath?: string;
  tauriServicePath?: string;
  utilsPath: string;
  typesPath?: string;
  cdpBridgePath?: string;
}> {
  log(`Building and packing services and dependencies (service: ${service})...`);

  try {
    // Build all packages
    execCommand('pnpm build', rootDir, 'Building all packages');

    // Pack native-utils (required for both services)
    const utilsDir = normalize(join(rootDir, 'packages', 'native-utils'));
    if (!existsSync(utilsDir)) {
      throw new Error(`Utils directory does not exist: ${utilsDir}`);
    }
    execCommand('pnpm pack', utilsDir, 'Packing @wdio/native-utils');

    const findTgzFile = (dir: string, prefix: string): string => {
      const files = readdirSync(dir);
      const tgzFile = files.find((f) => f.startsWith(prefix) && f.endsWith('.tgz'));
      if (!tgzFile) {
        throw new Error(`Could not find ${prefix} .tgz file in ${dir}`);
      }
      return normalize(join(dir, tgzFile));
    };

    const utilsPath = findTgzFile(utilsDir, 'wdio-native-utils-');

    const result: {
      electronServicePath?: string;
      tauriServicePath?: string;
      utilsPath: string;
      typesPath?: string;
      cdpBridgePath?: string;
    } = { utilsPath };

    // Pack Electron service and dependencies if needed
    if (service === 'electron' || service === 'both') {
      const electronServiceDir = normalize(join(rootDir, 'packages', 'electron-service'));
      const typesDir = normalize(join(rootDir, 'packages', 'electron-types'));
      const cdpBridgeDir = normalize(join(rootDir, 'packages', 'electron-cdp-bridge'));

      if (!existsSync(typesDir)) {
        throw new Error(`Types directory does not exist: ${typesDir}`);
      }
      if (!existsSync(cdpBridgeDir)) {
        throw new Error(`CDP Bridge directory does not exist: ${cdpBridgeDir}`);
      }

      execCommand('pnpm pack', typesDir, 'Packing @wdio/electron-types');
      execCommand('pnpm pack', cdpBridgeDir, 'Packing @wdio/electron-cdp-bridge');
      execCommand('pnpm pack', electronServiceDir, 'Packing @wdio/electron-service');

      result.electronServicePath = findTgzFile(electronServiceDir, 'wdio-electron-service-');
      result.typesPath = findTgzFile(typesDir, 'wdio-electron-types-');
      result.cdpBridgePath = findTgzFile(cdpBridgeDir, 'wdio-electron-cdp-bridge-');
    }

    // Pack Tauri service if needed
    if (service === 'tauri' || service === 'both') {
      const tauriServiceDir = normalize(join(rootDir, 'packages', 'tauri-service'));
      if (!existsSync(tauriServiceDir)) {
        throw new Error(`Tauri service directory does not exist: ${tauriServiceDir}`);
      }
      execCommand('pnpm pack', tauriServiceDir, 'Packing @wdio/tauri-service');
      result.tauriServicePath = findTgzFile(tauriServiceDir, 'wdio-tauri-service-');
    }

    log(`📦 Packages packed:`);
    log(`   Utils: ${utilsPath}`);
    if (result.electronServicePath) {
      log(`   Electron Service: ${result.electronServicePath}`);
      log(`   Types: ${result.typesPath}`);
      log(`   CDP Bridge: ${result.cdpBridgePath}`);
    }
    if (result.tauriServicePath) {
      log(`   Tauri Service: ${result.tauriServicePath}`);
    }

    return result;
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
  packages: {
    electronServicePath?: string;
    tauriServicePath?: string;
    utilsPath: string;
    typesPath?: string;
    cdpBridgePath?: string;
  },
  service: 'electron' | 'tauri',
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
  const tempDir = normalize(join(tmpdir(), `wdio-package-test-${Date.now()}`));
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

    // Build overrides and packages to install based on service type
    const overrides: Record<string, string> = {
      '@wdio/native-utils': `file:${packages.utilsPath}`,
    };
    const packagesToInstall: string[] = [packages.utilsPath];

    if (service === 'electron') {
      if (!packages.electronServicePath || !packages.typesPath || !packages.cdpBridgePath) {
        throw new Error('Electron service packages not available');
      }
      overrides['@wdio/electron-service'] = `file:${packages.electronServicePath}`;
      overrides['@wdio/electron-types'] = `file:${packages.typesPath}`;
      overrides['@wdio/electron-cdp-bridge'] = `file:${packages.cdpBridgePath}`;
      packagesToInstall.push(packages.typesPath, packages.cdpBridgePath, packages.electronServicePath);
    } else if (service === 'tauri') {
      if (!packages.tauriServicePath) {
        throw new Error('Tauri service package not available');
      }
      overrides['@wdio/tauri-service'] = `file:${packages.tauriServicePath}`;
      packagesToInstall.push(packages.tauriServicePath);
    }

    packageJson.pnpm = {
      ...packageJson.pnpm,
      overrides,
    };

    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Install all dependencies with pnpm
    execCommand('pnpm install', packageDir, `Installing dependencies for ${packageName}`);

    // Install local packages
    const addCommand = `pnpm add ${packagesToInstall.join(' ')}`;
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
    const serviceArg = args.find((arg) => arg.startsWith('--service='))?.split('=')[1];

    // Validate service argument if provided, default to 'both' if not provided
    let service: 'electron' | 'tauri' | 'both' = 'both';
    if (serviceArg) {
      if (serviceArg === 'electron' || serviceArg === 'tauri' || serviceArg === 'both') {
        service = serviceArg;
      } else {
        throw new Error(`Invalid service value: ${serviceArg}. Must be 'electron', 'tauri', or 'both'`);
      }
    }

    const options: TestOptions = {
      package: args.find((arg) => arg.startsWith('--package='))?.split('=')[1],
      skipBuild: args.includes('--skip-build'),
      service,
    };

    // Build and pack service (unless skipped)
    let packages: {
      electronServicePath?: string;
      tauriServicePath?: string;
      utilsPath: string;
      typesPath?: string;
      cdpBridgePath?: string;
    };
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

      const utilsDir = normalize(join(rootDir, 'packages', 'native-utils'));
      packages = {
        utilsPath: findTgzFile(utilsDir, 'wdio-native-utils-'),
      };

      if (options.service === 'electron' || options.service === 'both') {
        const electronServiceDir = normalize(join(rootDir, 'packages', 'electron-service'));
        const typesDir = normalize(join(rootDir, 'packages', 'electron-types'));
        const cdpBridgeDir = normalize(join(rootDir, 'packages', 'electron-cdp-bridge'));
        packages.electronServicePath = findTgzFile(electronServiceDir, 'wdio-electron-service-');
        packages.typesPath = findTgzFile(typesDir, 'wdio-electron-types-');
        packages.cdpBridgePath = findTgzFile(cdpBridgeDir, 'wdio-electron-cdp-bridge-');
      }

      if (options.service === 'tauri' || options.service === 'both') {
        const tauriServiceDir = normalize(join(rootDir, 'packages', 'tauri-service'));
        packages.tauriServicePath = findTgzFile(tauriServiceDir, 'wdio-tauri-service-');
      }

      log(`📦 Using existing packages:`);
      log(`   Utils: ${packages.utilsPath}`);
      if (packages.electronServicePath) {
        log(`   Electron Service: ${packages.electronServicePath}`);
        log(`   Types: ${packages.typesPath}`);
        log(`   CDP Bridge: ${packages.cdpBridgePath}`);
      }
      if (packages.tauriServicePath) {
        log(`   Tauri Service: ${packages.tauriServicePath}`);
      }
    } else {
      packages = await buildAndPackService(options.service);
    }

    // Find packages to test
    const packagesDir = normalize(join(rootDir, 'fixtures', 'package-tests'));
    if (!existsSync(packagesDir)) {
      throw new Error(`Packages directory not found: ${packagesDir}`);
    }

    const packageTestDirs = readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .filter((name) => !name.startsWith('.'));

    // Filter packages by service type (electron-* vs tauri-*)
    let filteredDirs = packageTestDirs;
    if (options.service === 'electron') {
      filteredDirs = packageTestDirs.filter((name) => name.startsWith('electron-'));
    } else if (options.service === 'tauri') {
      filteredDirs = packageTestDirs.filter((name) => name.startsWith('tauri-'));
    }
    // If service is 'both', don't filter

    // Filter packages if specific one requested
    const packagesToTest = options.package ? filteredDirs.filter((name) => name === options.package) : filteredDirs;

    if (packagesToTest.length === 0) {
      if (options.package) {
        throw new Error(`Package '${options.package}' not found. Available: ${packageTestDirs.join(', ')}`);
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

      // Detect service type from package name
      const detectedService: 'electron' | 'tauri' = packageName.startsWith('tauri-') ? 'tauri' : 'electron';

      // Skip if service type doesn't match
      if (options.service !== 'both' && detectedService !== options.service) {
        log(`⏭️  Skipping ${packageName} (service type ${detectedService} doesn't match filter ${options.service})`);
        continue;
      }

      await testExample(packagePath, packages, detectedService);
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
