#!/usr/bin/env node

/**
 * Smart Test Runner for wdio-desktop-mobile-testing
 *
 * This script analyzes git changes and runs only the relevant tests based on what packages have changed.
 *
 * Usage:
 *   tsx scripts/smart-test-runner.ts [options]
 *
 * Options:
 *   --dry-run    Show what would be run without executing
 *   --verbose    Show detailed output
 *   --help       Show this help message
 *
 * Examples:
 *   tsx scripts/smart-test-runner.ts                    # Run tests for changed packages
 *   tsx scripts/smart-test-runner.ts --dry-run          # Show what would be run
 *   tsx scripts/smart-test-runner.ts --verbose          # Show detailed output
 */

import { execSync } from 'node:child_process';

interface PackageInfo {
  name: string;
  path: string;
  type: 'service' | 'utility' | 'e2e';
  dependencies: string[];
  testTypes: {
    unit: boolean;
    integration: boolean;
    e2e: boolean;
  };
}

interface TestPlan {
  packages: string[];
  unitTests: string[];
  integrationTests: string[];
  e2eTests: string[];
  commands: string[];
}

// Package configuration mapping
const PACKAGE_CONFIG: Record<string, PackageInfo> = {
  '@wdio/bundler': {
    name: '@wdio/bundler',
    path: 'packages/bundler',
    type: 'utility',
    dependencies: [],
    testTypes: {
      unit: true,
      integration: true,
      e2e: false,
    },
  },
  '@wdio/electron-types': {
    name: '@wdio/electron-types',
    path: 'packages/electron-types',
    type: 'utility',
    dependencies: ['@wdio/bundler'],
    testTypes: {
      unit: false,
      integration: false,
      e2e: false,
    },
  },
  '@wdio/native-utils': {
    name: '@wdio/native-utils',
    path: 'packages/native-utils',
    type: 'utility',
    dependencies: ['@wdio/electron-types'],
    testTypes: {
      unit: true,
      integration: false,
      e2e: false,
    },
  },
  '@wdio/electron-cdp-bridge': {
    name: '@wdio/electron-cdp-bridge',
    path: 'packages/electron-cdp-bridge',
    type: 'utility',
    dependencies: ['@wdio/native-utils'],
    testTypes: {
      unit: true,
      integration: false,
      e2e: false,
    },
  },
  '@wdio/electron-service': {
    name: '@wdio/electron-service',
    path: 'packages/electron-service',
    type: 'service',
    dependencies: ['@wdio/electron-cdp-bridge'],
    testTypes: {
      unit: true,
      integration: false,
      e2e: true,
    },
  },
  '@wdio/tauri-service': {
    name: '@wdio/tauri-service',
    path: 'packages/tauri-service',
    type: 'service',
    dependencies: [],
    testTypes: {
      unit: true,
      integration: false,
      e2e: true,
    },
  },
};

// E2E test configurations
const E2E_TESTS = [
  'test:e2e:builder-cjs',
  'test:e2e:builder-esm',
  'test:e2e:forge-cjs',
  'test:e2e:forge-esm',
  'test:e2e:no-binary-cjs',
  'test:e2e:no-binary-esm',
  'test:e2e:tauri:basic',
  'test:e2e:tauri:basic:window',
  'test:e2e:tauri:basic:multiremote',
  'test:e2e:tauri:basic:standalone',
  'test:e2e:tauri-advanced',
];

function getChangedFiles(): string[] {
  try {
    // Get changed files from git
    const output = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' });
    return output
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    console.warn('Could not get git diff, using working directory changes');
    try {
      const output = execSync('git diff --name-only', { encoding: 'utf8' });
      return output
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);
    } catch {
      console.warn('Could not get git changes, running all tests');
      return [];
    }
  }
}

function getChangedPackages(changedFiles: string[]): string[] {
  const changedPackages = new Set<string>();

  for (const file of changedFiles) {
    // Check if file is in a package directory
    for (const [packageName, config] of Object.entries(PACKAGE_CONFIG)) {
      if (file.startsWith(`${config.path}/`)) {
        changedPackages.add(packageName);
        break;
      }
    }

    // Check for changes in e2e directory
    if (file.startsWith('e2e/')) {
      // E2E changes affect all tests
      return Object.keys(PACKAGE_CONFIG);
    }

    // Check for changes in fixtures directory
    if (file.startsWith('fixtures/')) {
      // Fixture changes affect all tests
      return Object.keys(PACKAGE_CONFIG);
    }

    // Check for changes in scripts or config files
    if (
      file.startsWith('scripts/') ||
      file.includes('turbo.json') ||
      file.includes('package.json') ||
      file.includes('tsconfig') ||
      file.includes('vitest.config') ||
      file.includes('biome.json')
    ) {
      // Config changes affect all tests
      return Object.keys(PACKAGE_CONFIG);
    }
  }

  return Array.from(changedPackages);
}

function getDependentPackages(changedPackages: string[]): string[] {
  const allAffected = new Set<string>(changedPackages);

  // Add packages that depend on changed packages
  for (const changedPackage of changedPackages) {
    for (const [packageName, config] of Object.entries(PACKAGE_CONFIG)) {
      if (config.dependencies.includes(changedPackage)) {
        allAffected.add(packageName);
      }
    }
  }

  return Array.from(allAffected);
}

function createTestPlan(affectedPackages: string[]): TestPlan {
  const plan: TestPlan = {
    packages: affectedPackages,
    unitTests: [],
    integrationTests: [],
    e2eTests: [],
    commands: [],
  };

  // Determine what tests to run based on affected packages
  let needsUnitTests = false;
  let needsIntegrationTests = false;
  let needsE2ETests = false;

  for (const packageName of affectedPackages) {
    const config = PACKAGE_CONFIG[packageName];
    if (!config) continue;

    if (config.testTypes.unit) {
      needsUnitTests = true;
      plan.unitTests.push(`${packageName}#test:unit`);
    }

    if (config.testTypes.integration) {
      needsIntegrationTests = true;
      plan.integrationTests.push(`${packageName}#test:integration`);
    }

    if (config.testTypes.e2e) {
      needsE2ETests = true;
    }
  }

  // Add e2e tests if needed
  if (needsE2ETests) {
    plan.e2eTests = E2E_TESTS;
  }

  // Build commands
  if (needsUnitTests) {
    plan.commands.push(`pnpm turbo run test:unit --filter="${plan.unitTests.join(',')}"`);
  }

  if (needsIntegrationTests) {
    plan.commands.push(`pnpm turbo run test:integration --filter="${plan.integrationTests.join(',')}"`);
  }

  if (needsE2ETests) {
    plan.commands.push(`pnpm turbo run ${plan.e2eTests.join(' ')}`);
  }

  return plan;
}

function printTestPlan(plan: TestPlan, verbose: boolean = false) {
  console.log('🧪 Smart Test Runner (wdio-desktop-mobile-testing)');
  console.log('================================================');
  console.log();

  console.log(`📦 Affected Packages: ${plan.packages.length}`);
  if (verbose) {
    for (const pkg of plan.packages) {
      console.log(`   - ${pkg}`);
    }
  } else {
    console.log(`   ${plan.packages.join(', ')}`);
  }
  console.log();

  if (plan.unitTests.length > 0) {
    console.log(`🔬 Unit Tests: ${plan.unitTests.length}`);
    if (verbose) {
      for (const test of plan.unitTests) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  if (plan.integrationTests.length > 0) {
    console.log(`🔗 Integration Tests: ${plan.integrationTests.length}`);
    if (verbose) {
      for (const test of plan.integrationTests) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  if (plan.e2eTests.length > 0) {
    console.log(`⚡ E2E Tests: ${plan.e2eTests.length}`);
    if (verbose) {
      for (const test of plan.e2eTests) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  console.log(`🚀 Commands to run:`);
  for (let i = 0; i < plan.commands.length; i++) {
    console.log(`   ${i + 1}. ${plan.commands[i]}`);
  }
  console.log();
}

async function executeCommands(commands: string[], dryRun: boolean = false) {
  if (dryRun) {
    console.log('🔍 Dry run mode - commands would be:');
    for (let i = 0; i < commands.length; i++) {
      console.log(`   ${i + 1}. ${commands[i]}`);
    }
    return;
  }

  console.log('🚀 Executing test commands...');
  console.log();

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    console.log(`[${i + 1}/${commands.length}] Running: ${cmd}`);
    console.log('─'.repeat(50));

    try {
      execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
      console.log(`✅ Command ${i + 1} completed successfully`);
    } catch (error) {
      console.error(`❌ Command ${i + 1} failed:`, error);
      process.exit(1);
    }

    console.log();
  }

  console.log('🎉 All tests completed successfully!');
}

function showHelp() {
  console.log(`
Smart Test Runner (wdio-desktop-mobile-testing)

Usage: tsx scripts/smart-test-runner.ts [options]

Options:
  --dry-run    Show what would be run without executing
  --verbose    Show detailed output
  --help       Show this help message

Examples:
  tsx scripts/smart-test-runner.ts                    # Run tests for changed packages
  tsx scripts/smart-test-runner.ts --dry-run          # Show what would be run
  tsx scripts/smart-test-runner.ts --verbose          # Show detailed output

Package Test Mapping:
  @wdio/bundler              → Unit + Integration tests
  @wdio/electron-types       → No tests (types only)
  @wdio/native-utils         → Unit tests
  @wdio/electron-cdp-bridge  → Unit tests
  @wdio/electron-service     → Unit + E2E tests
  @wdio/tauri-service        → Unit + E2E tests
`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');
  const help = args.includes('--help');

  if (help) {
    showHelp();
    return;
  }

  console.log('🔍 Analyzing changes...');
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('ℹ️  No changes detected, running all tests');
    const allPackages = Object.keys(PACKAGE_CONFIG);
    const plan = createTestPlan(allPackages);
    printTestPlan(plan, verbose);
    await executeCommands(plan.commands, dryRun);
    return;
  }

  if (verbose) {
    console.log(`📁 Changed files: ${changedFiles.length}`);
    for (const file of changedFiles) {
      console.log(`   - ${file}`);
    }
    console.log();
  }

  const changedPackages = getChangedPackages(changedFiles);
  const affectedPackages = getDependentPackages(changedPackages);

  const plan = createTestPlan(affectedPackages);
  printTestPlan(plan, verbose);

  if (plan.commands.length === 0) {
    console.log('ℹ️  No tests to run for the changed packages');
    return;
  }

  await executeCommands(plan.commands, dryRun);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
