import { resolve } from 'node:path';
import { RollupExecutor } from './executor.js';
import { ConfigGenerator } from './generator.js';
import { ConfigLoader } from './loader.js';
import { Logger } from './logger.js';
import type { BuildOptions, BundlerConfig } from './types.js';

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = Logger.create(options.verbose, options.extraVerbose);
  const loader = new ConfigLoader(process.cwd(), logger);
  const generator = new ConfigGenerator(logger);

  try {
    if (options.dryRun) {
      logger.info('🔍 Dry run: Generating configuration preview...');
    } else {
      logger.info('🔨 Building project...');
    }

    // Load bundler configuration
    const config = await loader.loadConfig();
    const packagePath = config.packageRoot || process.cwd();

    // Generate rollup configuration
    const generatedConfig = await generator.generateConfig(config, packagePath);

    // Handle config export if requested
    if (options.exportConfig) {
      const outputPath =
        typeof options.exportConfig === 'string'
          ? resolve(process.cwd(), options.exportConfig)
          : resolve(process.cwd(), 'rollup.config.js');

      await generator.writeConfig(generatedConfig, outputPath, false);
      logger.success(`Configuration exported to ${outputPath}`);
    }

    // Handle dry run
    if (options.dryRun) {
      // Show config preview (writeConfig with dryRun=true shows the content)
      await generator.writeConfig(generatedConfig, 'rollup.config.js', true);
      return;
    }

    // Execute build using programmatic API
    logger.info('🔨 Executing rollup build...');
    const executor = new RollupExecutor(logger);
    await executor.executeBuild(generatedConfig, packagePath, options.verbose);

    logger.success('Build completed successfully!');
  } catch (error) {
    logger.error(`Build failed: ${(error as Error).message}`);
    process.exit(1);
  }
}

export async function browserBuildCommand(options: BuildOptions): Promise<void> {
  const logger = Logger.create(options.verbose, options.extraVerbose);
  const loader = new ConfigLoader(process.cwd(), logger);
  const generator = new ConfigGenerator(logger);

  try {
    if (options.dryRun) {
      logger.info('🔍 Dry run: Generating browser configuration preview...');
    } else {
      logger.info('🔨 Building browser bundle...');
    }

    // Load bundler configuration
    const config = (await loader.loadConfig()) as BundlerConfig;
    const packagePath = config.packageRoot || process.cwd();

    // Check for browser config
    if (!config.browser) {
      logger.error('No browser configuration found in wdio-bundler.config.ts');
      process.exit(1);
    }

    // Generate browser rollup configuration
    const generatedConfig = await generator.generateBrowserConfig(config, packagePath);

    // Handle config export if requested
    if (options.exportConfig) {
      const outputPath =
        typeof options.exportConfig === 'string'
          ? resolve(process.cwd(), options.exportConfig)
          : resolve(process.cwd(), 'rollup.browser.config.js');

      await generator.writeConfig(generatedConfig, outputPath, false);
      logger.success(`Browser configuration exported to ${outputPath}`);
    }

    // Handle dry run
    if (options.dryRun) {
      await generator.writeConfig(generatedConfig, 'rollup.browser.config.js', true);
      return;
    }

    // Execute build using programmatic API
    logger.info('🔨 Executing rollup browser build...');
    const executor = new RollupExecutor(logger);
    await executor.executeBuild(generatedConfig, packagePath, options.verbose);

    logger.success('Browser build completed successfully!');
  } catch (error) {
    logger.error(`Browser build failed: ${(error as Error).message}`);
    process.exit(1);
  }
}
