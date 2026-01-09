#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const PUPPETEER_DIR = join(ROOT_DIR, '..', 'puppeteer');
const WEBDRIVERIO_DIR = join(ROOT_DIR, '..', 'webdriverio');
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

  // Copy to workspace
  const packedFile = 'puppeteer-browsers-2.11.0.tgz';
  runCommand(`cp ${TMP_DIR}/${packedFile} ${ROOT_DIR}/`);

  console.log('✅ @puppeteer/browsers repackaged\n');
}

/**
 * Update wdio-utils package
 */
function updateWdioUtils() {
  console.log('🔧 Updating @wdio/utils...');

  // Build wdio-utils
  runCommand('pnpm -r --filter=@wdio/compiler run build -p @wdio/utils', WEBDRIVERIO_DIR);

  // Package it
  runCommand(`npm pack --pack-destination ${TMP_DIR}`, join(WEBDRIVERIO_DIR, 'packages', 'wdio-utils'));

  // Extract and fix dependencies
  const packedFile = 'wdio-utils-9.19.1.tgz';
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
 * Update workspace dependencies
 */
function updateWorkspace() {
  console.log('🔧 Updating workspace dependencies...');

  // Clear cache and reinstall
  runCommand('pnpm store prune', ROOT_DIR);
  runCommand('rm -f pnpm-lock.yaml', ROOT_DIR);
  runCommand('pnpm install', ROOT_DIR);

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
    updateWorkspace();

    console.log('🎉 All packages updated successfully!');
    console.log('\n📋 Summary:');
    console.log('- @puppeteer/browsers: Enhanced with Electron fallback sources');
    console.log('- @wdio/utils: Updated to detect electron usage and use fallback sources');
    console.log('- Workspace: Updated with new package versions');
    console.log('\n🚀 Ready for ARM64 CI testing!');
  } catch (error) {
    console.error('\n❌ Package update failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
