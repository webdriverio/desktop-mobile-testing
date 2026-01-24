#!/usr/bin/env node

import { Command } from 'commander';
import { browserBuildCommand, buildCommand } from './cli/commands.js';

const program = new Command();

program.name('wdio-bundler').description('WebdriverIO Electron Service bundler CLI').version('8.2.1');

// Library build command (ESM + CJS)
program
  .command('build')
  .description('Build project using generated rollup configuration')
  .option('--dry-run', 'Show generated config without building')
  .option('--export-config [path]', 'Export rollup config to file (default: rollup.config.js)')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--vv, --extra-verbose', 'Show extra detailed progress')
  .action(buildCommand);

// Browser build command (ESM only)
program
  .command('build:browser')
  .description('Build browser bundle using wdio-bundler.config.ts browser config')
  .option('--dry-run', 'Show generated config without building')
  .option('--export-config [path]', 'Export rollup config to file')
  .option('-v, --verbose', 'Show detailed progress')
  .option('--vv, --extra-verbose', 'Show extra detailed progress')
  .action(browserBuildCommand);

program.parse();
