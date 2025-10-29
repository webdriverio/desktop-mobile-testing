#!/usr/bin/env node

/**
 * Smart Test Runner with Turbo Integration (wdio-desktop-mobile-testing)
 *
 * This script leverages Turbo's built-in change detection and dependency graph
 * to run only the relevant tests based on what packages have changed.
 *
 * Usage:
 *   tsx scripts/smart-test-runner-turbo.ts [options]
 *
 * Options:
 *   --dry-run    Show what would be run without executing
 *   --verbose    Show detailed output
 *   --help       Show this help message
 *   --tasks      Comma-separated list of tasks to run (e.g., "test:unit,test:e2e")
 *
 * Examples:
 *   tsx scripts/smart-test-runner-turbo.ts                    # Run tests for changed packages
 *   tsx scripts/smart-test-runner-turbo.ts --dry-run          # Show what would be run
 *   tsx scripts/smart-test-runner-turbo.ts --verbose          # Show detailed output
 *   tsx scripts/smart-test-runner-turbo.ts --tasks "test:unit,test:e2e"  # Run specific tasks
 */

import { execSync } from 'node:child_process';

interface TurboTask {
  taskId: string;
  task: string;
  package: string;
  hash: string;
  cache: {
    local: boolean;
    remote: boolean;
    status: 'HIT' | 'MISS' | 'ERROR';
    timeSaved: number;
  };
  dependencies: string[];
  dependents: string[];
  directory: string;
  command: string;
  cliArguments: string[];
}

interface TurboDryRunResult {
  tasks: TurboTask[];
  scm: {
    type: string;
    sha: string;
    branch: string;
  };
}

interface TestPlan {
  tasks: TurboTask[];
  packages: string[];
  testTypes: {
    unit: string[];
    integration: string[];
    e2e: string[];
  };
  commands: string[];
  cacheStats: {
    hits: number;
    misses: number;
    timeSaved: number;
  };
}

// Test type mappings for different task patterns
const TEST_TYPE_MAPPINGS = {
  unit: ['test:unit'],
  integration: ['test:integration'],
  e2e: [
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
  ],
};

function getTurboDryRun(tasks: string[] = ['test:unit', 'test:integration', 'test:e2e']): TurboDryRunResult {
  try {
    const taskList = tasks.join(',');
    const output = execSync(`pnpm turbo run ${taskList} --dry-run=json`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return JSON.parse(output);
  } catch (_error) {
    console.warn('Could not get Turbo dry-run, falling back to all tests');
    return { tasks: [], scm: { type: 'git', sha: '', branch: '' } };
  }
}

function filterTasksByChange(tasks: TurboTask[]): TurboTask[] {
  // Filter out tasks that are cached (HIT) and don't need to run
  return tasks.filter(
    (task) =>
      task.cache.status === 'MISS' ||
      task.cache.status === 'ERROR' ||
      // Include tasks that have dependents that need to run
      task.dependents.some((dependent) => tasks.find((t) => t.taskId === dependent)?.cache.status === 'MISS'),
  );
}

function categorizeTasks(tasks: TurboTask[]): TestPlan['testTypes'] {
  const testTypes = {
    unit: [] as string[],
    integration: [] as string[],
    e2e: [] as string[],
  };

  for (const task of tasks) {
    // Unit tests
    if (TEST_TYPE_MAPPINGS.unit.some((pattern) => task.task.includes(pattern))) {
      testTypes.unit.push(task.taskId);
    }

    // Integration tests
    if (TEST_TYPE_MAPPINGS.integration.some((pattern) => task.task.includes(pattern))) {
      testTypes.integration.push(task.taskId);
    }

    // E2E tests
    if (TEST_TYPE_MAPPINGS.e2e.some((pattern) => task.task.includes(pattern))) {
      testTypes.e2e.push(task.taskId);
    }
  }

  return testTypes;
}

function createTestPlan(tasks: TurboTask[], _requestedTasks?: string[]): TestPlan {
  const changedTasks = filterTasksByChange(tasks);
  const testTypes = categorizeTasks(changedTasks);

  // Get unique packages from changed tasks
  const packages = [...new Set(changedTasks.map((task) => task.package))];

  // Calculate cache statistics
  const cacheStats = {
    hits: tasks.filter((t) => t.cache.status === 'HIT').length,
    misses: tasks.filter((t) => t.cache.status === 'MISS').length,
    timeSaved: tasks.reduce((sum, t) => sum + t.cache.timeSaved, 0),
  };

  // Build commands based on what needs to run
  const commands: string[] = [];

  if (testTypes.unit.length > 0) {
    commands.push(`pnpm turbo run test:unit --filter="${testTypes.unit.join(',')}"`);
  }

  if (testTypes.integration.length > 0) {
    commands.push(`pnpm turbo run test:integration --filter="${testTypes.integration.join(',')}"`);
  }

  if (testTypes.e2e.length > 0) {
    commands.push(`pnpm turbo run ${testTypes.e2e.join(' ')}`);
  }

  return {
    tasks: changedTasks,
    packages,
    testTypes,
    commands,
    cacheStats,
  };
}

function printTestPlan(plan: TestPlan, verbose = false) {
  console.log('🧪 Smart Test Runner (Turbo Integration - wdio-desktop-mobile-testing)');
  console.log('====================================================================');
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

  console.log(`📊 Cache Statistics:`);
  console.log(`   Hits: ${plan.cacheStats.hits}`);
  console.log(`   Misses: ${plan.cacheStats.misses}`);
  console.log(`   Time Saved: ${plan.cacheStats.timeSaved}ms`);
  console.log();

  if (plan.testTypes.unit.length > 0) {
    console.log(`🔬 Unit Tests: ${plan.testTypes.unit.length}`);
    if (verbose) {
      for (const test of plan.testTypes.unit) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  if (plan.testTypes.integration.length > 0) {
    console.log(`🔗 Integration Tests: ${plan.testTypes.integration.length}`);
    if (verbose) {
      for (const test of plan.testTypes.integration) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  if (plan.testTypes.e2e.length > 0) {
    console.log(`⚡ E2E Tests: ${plan.testTypes.e2e.length}`);
    if (verbose) {
      for (const test of plan.testTypes.e2e) {
        console.log(`   - ${test}`);
      }
    }
    console.log();
  }

  console.log('🚀 Commands to run:');
  for (let i = 0; i < plan.commands.length; i++) {
    console.log(`   ${i + 1}. ${plan.commands[i]}`);
  }
  console.log();
}

async function executeCommands(commands: string[], dryRun = false) {
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
Smart Test Runner (Turbo Integration - wdio-desktop-mobile-testing)

Usage: tsx scripts/smart-test-runner-turbo.ts [options]

Options:
  --dry-run    Show what would be run without executing
  --verbose    Show detailed output
  --help       Show this help message
  --tasks      Comma-separated list of tasks to run (e.g., "test:unit,test:e2e")

Examples:
  tsx scripts/smart-test-runner-turbo.ts                    # Run tests for changed packages
  tsx scripts/smart-test-runner-turbo.ts --dry-run          # Show what would be run
  tsx scripts/smart-test-runner-turbo.ts --verbose          # Show detailed output
  tsx scripts/smart-test-runner-turbo.ts --tasks "test:unit,test:e2e"  # Run specific tasks

Features:
  - Leverages Turbo's built-in change detection
  - Respects Turbo's dependency graph
  - Shows cache statistics (hits/misses/time saved)
  - Automatically filters out cached tasks
  - Supports custom task selection
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

  // Parse custom tasks if provided
  const tasksArg = args.find((arg) => arg.startsWith('--tasks='));
  const customTasks = tasksArg ? tasksArg.split('=')[1].split(',') : undefined;

  console.log('🔍 Analyzing changes with Turbo...');

  const turboResult = getTurboDryRun(customTasks);

  if (turboResult.tasks.length === 0) {
    console.log('ℹ️  No tasks found, running all tests');
    const allTasks = getTurboDryRun(['test:unit', 'test:integration', 'test:e2e']);
    const plan = createTestPlan(allTasks.tasks, customTasks);
    printTestPlan(plan, verbose);
    await executeCommands(plan.commands, dryRun);
    return;
  }

  if (verbose) {
    console.log(`📋 Total tasks analyzed: ${turboResult.tasks.length}`);
    console.log(`📊 Cache hits: ${turboResult.tasks.filter((t) => t.cache.status === 'HIT').length}`);
    console.log(`📊 Cache misses: ${turboResult.tasks.filter((t) => t.cache.status === 'MISS').length}`);
    console.log();
  }

  const plan = createTestPlan(turboResult.tasks, customTasks);
  printTestPlan(plan, verbose);

  if (plan.commands.length === 0) {
    console.log('ℹ️  No tests to run - all tasks are cached or no changes detected');
    return;
  }

  await executeCommands(plan.commands, dryRun);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
