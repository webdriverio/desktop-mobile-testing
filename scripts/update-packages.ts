#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const PUPPETEER_DIR = join(ROOT_DIR, '..', 'puppeteer');
const WEBDRIVERIO_DIR = join(ROOT_DIR, '..', 'webdriverio');
const TAURI_DIR = join(ROOT_DIR, '..', 'tauri');
const TMP_DIR = '/tmp';

console.log('🚀 Starting package update process...\n');

/**
 * Execute a command and log it
 */
function runCommand(command: string, cwd?: string) {
  console.log(`📝 Running: ${command}`);
  try {
    execSync(command, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' },
    });
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    throw error;
  }
}

/**
 * Update puppeteer browsers package
 */
function updatePuppeteerBrowsers() {
  console.log('🔧 Updating @puppeteer/browsers...');

  const browsersDir = join(PUPPETEER_DIR, 'packages', 'browsers');
  const libDir = join(browsersDir, 'lib');

  // Check if built version exists
  if (!existsSync(libDir)) {
    throw new Error('@puppeteer/browsers is not built. Please build it first with: cd ../puppeteer && pnpm build');
  }

  console.log('📦 Repackaging @puppeteer/browsers...');

  // Package it (uses existing built version)
  runCommand(`npm pack --pack-destination ${TMP_DIR}`, browsersDir);

  // Get the actual packed filename (it includes version)
  const packOutput = execSync('npm pack --dry-run', { cwd: browsersDir, encoding: 'utf8' });
  const packMatch = packOutput.match(/puppeteer-browsers-[\d.]+\.tgz/);
  if (!packMatch) {
    throw new Error('Could not determine packed filename from npm pack output');
  }
  const packedFile = packMatch[0];

  // Copy to workspace
  runCommand(`cp ${TMP_DIR}/${packedFile} ${ROOT_DIR}/`);

  console.log('✅ @puppeteer/browsers repackaged\n');
}

/**
 * Update wdio-utils package
 */
function updateWdioUtils() {
  console.log('🔧 Updating @wdio/utils...');

  // Build wdio-utils
  console.log('  🔨 Compiling wdio-utils...');
  runCommand('pnpm exec tsx ./infra/compiler/src/index.ts -p @wdio/utils', WEBDRIVERIO_DIR);

  // Package it
  const wdioUtilsDir = join(WEBDRIVERIO_DIR, 'packages', 'wdio-utils');
  runCommand(`npm pack --pack-destination ${TMP_DIR}`, wdioUtilsDir);

  // Get the actual packed filename
  const wdioPackOutput = execSync('npm pack --dry-run', { cwd: wdioUtilsDir, encoding: 'utf8' });
  const wdioPackMatch = wdioPackOutput.match(/wdio-utils-[\d.]+\.tgz/);
  if (!wdioPackMatch) {
    throw new Error('Could not determine packed filename from npm pack output');
  }
  const packedFile = wdioPackMatch[0];

  // Extract and fix dependencies
  const extractDir = join(TMP_DIR, 'wdio-utils-fix');

  // Clean up any existing extract dir
  if (existsSync(extractDir)) {
    runCommand(`rm -rf ${extractDir}`);
  }

  // Extract
  mkdirSync(extractDir);
  runCommand(`tar -xf ${TMP_DIR}/${packedFile}`, extractDir);

  // Fix dependencies in package.json
  const packageJsonPath = join(extractDir, 'package', 'package.json');
  runCommand(
    `jq '
    .dependencies["@wdio/logger"] = "^9.18.0" |
    .dependencies["@wdio/types"] = "9.20.0" |
    del(.dependencies["@wdio/chromedriver-downloader"])
  ' "${packageJsonPath}" > "${packageJsonPath}.tmp"`,
    extractDir,
  );

  runCommand(`mv ${packageJsonPath}.tmp ${packageJsonPath}`, extractDir);

  // Repackage
  runCommand(`tar -czf ${ROOT_DIR}/${packedFile} -C ${extractDir} package`);

  // Clean up
  runCommand(`rm -rf ${extractDir}`);

  console.log('✅ @wdio/utils updated\n');
}

/**
 * Update tauri-driver binary from local tauri repo
 * Builds and installs the local tauri-driver to override the published version
 */
function updateTauriDriver() {
  console.log('🔧 Updating tauri-driver...');

  const tauriDriverDir = join(TAURI_DIR, 'crates', 'tauri-driver');

  // Check if tauri-driver source exists
  if (!existsSync(tauriDriverDir)) {
    throw new Error(
      'tauri-driver source not found. Please ensure the tauri repo is cloned at: ' + join(ROOT_DIR, '..', 'tauri'),
    );
  }

  console.log('  🔨 Building tauri-driver from local source...');

  // Build tauri-driver in release mode
  runCommand('cargo build --release', tauriDriverDir);

  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'tauri-driver.exe' : 'tauri-driver';

  // In a Cargo workspace, the target directory is at the workspace root, not in the crate directory
  const builtBinary = join(TAURI_DIR, 'target', 'release', binaryName);

  // Check if build succeeded
  if (!existsSync(builtBinary)) {
    throw new Error(`tauri-driver build failed. Binary not found at: ${builtBinary}`);
  }

  console.log('  📦 Packaging tauri-driver...');

  // Create a tarball of the binary
  const tauriDriverTmpDir = join(TMP_DIR, 'tauri-driver-package');
  const tarballName = `tauri-driver-local.tgz`;

  // Clean up any existing temp dir
  if (existsSync(tauriDriverTmpDir)) {
    runCommand(`rm -rf ${tauriDriverTmpDir}`);
  }

  // Create package structure
  mkdirSync(join(tauriDriverTmpDir, 'bin'), { recursive: true });

  // Copy binary to package
  runCommand(`cp ${builtBinary} ${join(tauriDriverTmpDir, 'bin', binaryName)}`);

  // Create a simple package.json for consistency with other packages
  const packageJson = {
    name: 'tauri-driver-local',
    version: 'local',
    description: 'Local build of tauri-driver with WebDriver stdout fix',
    bin: {
      'tauri-driver': `./bin/${binaryName}`,
    },
  };

  writeFileSync(join(tauriDriverTmpDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  // Create tarball
  runCommand(`tar -czf ${ROOT_DIR}/${tarballName} -C ${tauriDriverTmpDir} .`);

  // Also copy binary to a known location where driverManager can find it
  const localBinDir = join(ROOT_DIR, '.local-bin');
  mkdirSync(localBinDir, { recursive: true });
  runCommand(`cp ${builtBinary} ${join(localBinDir, binaryName)}`);

  // Make executable on Unix
  if (!isWindows) {
    runCommand(`chmod +x ${join(localBinDir, binaryName)}`);
  }

  // Clean up temp dir
  runCommand(`rm -rf ${tauriDriverTmpDir}`);

  console.log(`  ✓ tauri-driver binary: ${localBinDir}/${binaryName}`);
  console.log(`  ✓ tauri-driver tarball: ${ROOT_DIR}/${tarballName}`);
  console.log('✅ tauri-driver updated\n');
}

/**
 * Update workspace dependencies
 */
function updateWorkspace() {
  console.log('🔧 Updating workspace dependencies...');

  // Clear cache and reinstall
  // Note: Regenerating pnpm-lock.yaml ensures CI cache is busted when tarballs change
  runCommand('pnpm store prune', ROOT_DIR);
  runCommand('rm -f pnpm-lock.yaml', ROOT_DIR);
  runCommand('pnpm install', ROOT_DIR);

  console.log('  ✓ pnpm-lock.yaml regenerated (this will bust CI cache)');
  console.log('✅ Workspace updated\n');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('📦 Updating all packages...\n');

    updatePuppeteerBrowsers();
    updateWdioUtils();
    updateTauriDriver();
    updateWorkspace();

    console.log('🎉 All packages updated successfully!');
    console.log('\n📋 Summary:');
    console.log('- @puppeteer/browsers: Enhanced with Electron fallback sources');
    console.log('- @wdio/utils: Updated to detect electron usage and use fallback sources');
    console.log('- tauri-driver: Local build with WebDriver stdout/stderr fix');
    console.log('- Workspace: Updated with new package versions');
    console.log('\n🚀 Ready for ARM64 CI testing!');
  } catch (error) {
    console.error('\n❌ Package update failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
