#!/usr/bin/env node
import { type ExecException, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface PackageJson {
  version: string;
  name: string;
}

interface ServicePackageMap {
  service: string[];
  shared: string[];
}

// Service to package directory mapping
const SERVICE_PACKAGES: Record<string, ServicePackageMap> = {
  electron: {
    service: ['electron-service', 'electron-cdp-bridge', 'bundler'],
    shared: ['native-utils', 'native-types'],
  },
  tauri: {
    service: ['tauri-service', 'tauri-plugin'],
    shared: ['native-utils', 'native-types'],
  },
};

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

// Execute a command and return its output
function runCommand(command: string, allowFailure = false): string {
  console.log(`Executing: ${command}`);
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });

    // execSync returns a string when encoding is 'utf-8'
    const output = result as string;
    console.log(`Command completed successfully, output length: ${output.length}`);
    return output.trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    console.error(`Error executing command: ${command}`);
    const execError = error as ExecException;

    // Log error details
    console.error('Error details:', execError);

    throw new Error(`Command execution failed: ${command}`);
  }
}

// Get full scoped package name from directory name
function getScopedPackageName(simpleName: string): string | null {
  const pkgJsonPath = path.join('packages', simpleName, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJson = readPackageJson(pkgJsonPath);
    return pkgJson ? pkgJson.name : null;
  }
  return null;
}

// Get the last git tag for a specific package
function getLastPackageTag(packageDir: string): string | null {
  const scopedName = getScopedPackageName(packageDir);
  if (!scopedName) return null;

  // Convert @wdio/electron-service to electron-service-v*
  const packageName = scopedName.split('/')[1];
  const tagPattern = `${packageName}-v*`;

  const tags = runCommand(`git tag -l "${tagPattern}" --sort=-v:refname`, true);
  const latestTag = tags.split('\n')[0];
  return latestTag || null;
}

// Check if a package has changed since its last tag
function hasPackageChanged(packageDir: string): boolean {
  const lastTag = getLastPackageTag(packageDir);
  const packagePath = `packages/${packageDir}`;

  if (!lastTag) {
    console.log(`📦 ${packageDir}: No previous tag found, considering it changed`);
    return true;
  }

  console.log(`📦 ${packageDir}: Last tag is ${lastTag}`);

  const diff = runCommand(`git diff --name-only ${lastTag}..HEAD -- ${packagePath}`, true);
  const hasChanges = diff.length > 0;

  console.log(`   ${hasChanges ? '✓ Has changes' : '○ No changes'}`);
  if (hasChanges) {
    console.log(`   Changed files:\n   ${diff.split('\n').join('\n   ')}`);
  }

  return hasChanges;
}

// Analyze commits for a package to determine bump type
function analyzeCommitsForBumpType(packageDir: string): 'major' | 'minor' | 'patch' {
  const lastTag = getLastPackageTag(packageDir);
  const packagePath = `packages/${packageDir}`;

  if (!lastTag) {
    console.log(`   No tag history, defaulting to patch`);
    return 'patch';
  }

  // Get commits that affected this package
  const commits = runCommand(`git log ${lastTag}..HEAD --oneline --no-merges -- ${packagePath}`, true);

  if (!commits) {
    return 'patch';
  }

  console.log(`   Analyzing ${commits.split('\n').length} commits...`);

  // Check for breaking changes
  if (commits.match(/BREAKING CHANGE:|!:/)) {
    console.log(`   ⚠️  Breaking changes detected → major bump`);
    return 'major';
  }

  // Check for features
  if (commits.match(/^[a-f0-9]+ feat(\(.*?\))?:/m)) {
    console.log(`   ✨ Features detected → minor bump`);
    return 'minor';
  }

  // Check for fixes
  if (commits.match(/^[a-f0-9]+ fix(\(.*?\))?:/m)) {
    console.log(`   🐛 Fixes detected → patch bump`);
    return 'patch';
  }

  // Default to patch for any other changes
  console.log(`   📝 Other changes detected → patch bump`);
  return 'patch';
}

// Set GitHub Actions output
function setOutput(name: string, value: string) {
  const githubOutputFile = process.env.GITHUB_OUTPUT;
  if (githubOutputFile) {
    console.log(`Setting output ${name}=${value}`);
    fs.appendFileSync(githubOutputFile, `${name}=${value}\n`);
  } else {
    console.warn('GITHUB_OUTPUT environment variable not set');
  }
}

async function main() {
  // Read inputs
  const service = process.env.INPUT_SERVICE || '';
  const releaseVersionInput = process.env.INPUT_RELEASE_VERSION;
  const dryRun = process.env.INPUT_DRY_RUN === 'true';
  const workspaceRoot = process.env.GITHUB_WORKSPACE || '.';

  if (!service || !SERVICE_PACKAGES[service]) {
    console.error(`Error: Invalid service "${service}". Must be "electron" or "tauri".`);
    process.exit(1);
  }

  if (!releaseVersionInput) {
    console.error('Error: INPUT_RELEASE_VERSION is required.');
    process.exit(1);
  }

  console.log(`Service: ${service}`);
  console.log(`Release Version Input: ${releaseVersionInput}`);
  console.log(`Dry Run: ${dryRun}`);
  process.chdir(workspaceRoot);

  const packageMap = SERVICE_PACKAGES[service];

  // Log current package versions
  console.log('\n========== CURRENT PACKAGE VERSIONS ==========');
  const allPackages = [...packageMap.service, ...packageMap.shared];
  for (const pkg of allPackages) {
    const pkgJson = readPackageJson(path.join('packages', pkg, 'package.json'));
    if (pkgJson) {
      const type = packageMap.service.includes(pkg) ? 'SERVICE' : 'SHARED';
      console.log(`📦 ${pkgJson.name} [${type}]: ${pkgJson.version}`);
    }
  }
  console.log('=============================================\n');

  // Detect changes in shared packages
  console.log('========== DETECTING SHARED PACKAGE CHANGES ==========');
  const sharedPackageChanges: Record<string, { changed: boolean; bumpType?: string }> = {};

  for (const sharedPkg of packageMap.shared) {
    const hasChanges = hasPackageChanged(sharedPkg);
    if (hasChanges) {
      const bumpType = analyzeCommitsForBumpType(sharedPkg);
      sharedPackageChanges[sharedPkg] = { changed: true, bumpType };
    } else {
      sharedPackageChanges[sharedPkg] = { changed: false };
    }
  }
  console.log('====================================================\n');

  // Determine bump flag for service packages
  let bumpFlag: string;
  if (['patch', 'minor', 'major'].includes(releaseVersionInput)) {
    bumpFlag = `--bump ${releaseVersionInput}`;
  } else if (releaseVersionInput.startsWith('pre')) {
    // All pre-release types use 'next' as the pre-id (configured in version.config.json)
    bumpFlag = `--bump ${releaseVersionInput}`;
  } else {
    console.error(`Error: Invalid release version: ${releaseVersionInput}`);
    process.exit(1);
  }

  // Get scoped package names for service packages
  const serviceScopedNames = packageMap.service.map((dir) => getScopedPackageName(dir)).filter(Boolean) as string[];

  console.log('========== SERVICE PACKAGES ==========');
  console.log(`Directories: ${packageMap.service.join(', ')}`);
  console.log(`Scoped names: ${serviceScopedNames.join(', ')}`);
  console.log(`Bump type: ${releaseVersionInput}`);
  console.log('======================================\n');

  // Calculate service version (dry-run to get the version)
  const serviceTargetsArg = serviceScopedNames.join(',');
  const serviceVersionCmd = `pnpm package-versioner ${bumpFlag} --dry-run --json -t ${serviceTargetsArg} 2>/dev/null`;

  console.log(`\n========== PACKAGE-VERSIONER COMMAND ==========`);
  console.log(`Command: ${serviceVersionCmd}`);
  console.log('===============================================\n');

  let serviceVersion: string | null = null;
  const serviceOutput = runCommand(serviceVersionCmd);

  console.log(`========== PACKAGE-VERSIONER RAW OUTPUT ==========`);
  console.log(`Length: ${serviceOutput.length}`);
  console.log(`Starts with: '${serviceOutput.substring(0, 50)}'`);
  console.log(`Ends with: '${serviceOutput.slice(-50)}'`);
  console.log(`Contains 'dryRun'?: ${serviceOutput.includes('dryRun')}`);
  console.log(`Contains 'updates'?: ${serviceOutput.includes('updates')}`);
  console.log('Full output:');
  console.log(serviceOutput);
  console.log('=================================================\n');

  try {
    // Clean the output - sometimes there might be extra whitespace or newlines
    const cleanOutput = serviceOutput.trim();

    // Check for common non-JSON output that might indicate an error
    if (cleanOutput.includes('ERR_') || cleanOutput.includes('Error:') || cleanOutput.includes('pnpm:')) {
      throw new Error(`Command output appears to contain an error message: ${cleanOutput.substring(0, 200)}...`);
    }

    // Validate that the output starts and ends with JSON braces/brackets
    if (!cleanOutput.startsWith('{') && !cleanOutput.startsWith('[')) {
      throw new Error(
        `Output does not appear to be JSON. Expected to start with '{' or '[' but got: ${cleanOutput.substring(0, 100)}...`,
      );
    }

    if (!cleanOutput.endsWith('}') && !cleanOutput.endsWith(']')) {
      throw new Error(
        `Output does not appear to be valid JSON. Expected to end with '}' or ']' but got: ...${cleanOutput.slice(-100)}`,
      );
    }

    console.log('Attempting to parse JSON...');
    const jsonOutput = JSON.parse(cleanOutput);
    console.log('JSON parsed successfully!');

    if (!jsonOutput.updates || !Array.isArray(jsonOutput.updates)) {
      throw new Error('JSON output missing "updates" array');
    }

    const refPackageUpdate = jsonOutput.updates[0];

    if (refPackageUpdate?.newVersion) {
      serviceVersion = refPackageUpdate.newVersion;
      console.log(`✓ Service version: ${serviceVersion}\n`);
    } else {
      throw new Error(
        `Could not find newVersion in first update. Available updates: ${JSON.stringify(jsonOutput.updates, null, 2)}`,
      );
    }
  } catch (error) {
    console.error(`Error parsing service version: ${(error as Error).message}`);
    console.error('Raw output was:', serviceOutput);
    console.error('Output length:', serviceOutput.length);
    console.error('First 200 chars:', serviceOutput.substring(0, 200));
    console.error('Last 200 chars:', serviceOutput.slice(-200));
    process.exit(1);
  }

  // Set outputs
  if (!serviceVersion) {
    console.error('Failed to determine service version');
    process.exit(1);
  }
  setOutput('service_version', serviceVersion);
  setOutput('service_package_list', serviceScopedNames.join(','));

  // Process shared packages
  const changedSharedPackages: string[] = [];
  for (const [pkgDir, info] of Object.entries(sharedPackageChanges)) {
    if (info.changed && info.bumpType) {
      const scopedName = getScopedPackageName(pkgDir);
      if (scopedName) {
        changedSharedPackages.push(scopedName);

        // Calculate version for this shared package
        const sharedBumpFlag = `--bump ${info.bumpType}`;
        const sharedVersionCmd = `pnpm package-versioner ${sharedBumpFlag} --dry-run --json -t ${scopedName} 2>/dev/null`;

        console.log(`\n========== SHARED PACKAGE COMMAND ==========`);
        console.log(`Package: ${scopedName}`);
        console.log(`Command: ${sharedVersionCmd}`);
        console.log('============================================\n');

        const sharedOutput = runCommand(sharedVersionCmd);

        console.log(`========== SHARED PACKAGE RAW OUTPUT ==========`);
        console.log(`Package: ${scopedName}`);
        console.log(sharedOutput);
        console.log('================================================\n');

        try {
          const jsonOutput = JSON.parse(sharedOutput);
          const update = jsonOutput.updates?.[0];

          if (update?.newVersion) {
            const outputKey = `shared_version_${pkgDir.replace(/-/g, '_')}`;
            setOutput(outputKey, update.newVersion);
            setOutput(`${outputKey}_bump`, info.bumpType);
            console.log(`✓ ${scopedName}: ${update.oldVersion} → ${update.newVersion} (${info.bumpType})`);
          }
        } catch (error) {
          console.error(`Error calculating version for ${scopedName}: ${(error as Error).message}`);
          console.error('Raw output was:', sharedOutput);
        }
      }
    }
  }

  setOutput('shared_packages_changed', changedSharedPackages.length > 0 ? 'true' : 'false');
  setOutput('shared_package_list', changedSharedPackages.join(','));

  console.log('\n========== VERSION CALCULATION COMPLETE ==========');
  console.log(`Service Version: ${serviceVersion}`);
  console.log(
    `Changed Shared Packages: ${changedSharedPackages.length > 0 ? changedSharedPackages.join(', ') : 'none'}`,
  );
  console.log('==================================================\n');
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
