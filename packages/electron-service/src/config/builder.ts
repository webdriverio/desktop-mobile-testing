import path from 'node:path';
import type { BuilderBuildInfo, BuilderConfig } from '@wdio/native-types';
import { createLogger, type NormalizedReadResult, readConfig } from '@wdio/native-utils';
import { deepmerge as deepMerge } from 'deepmerge-ts';
import { APP_NAME_DETECTION_ERROR } from '../constants.js';

const log = createLogger('electron-service', 'config');

export async function getConfig(
  pkg: NormalizedReadResult,
  customConfigPath?: string,
): Promise<BuilderBuildInfo | undefined> {
  const rootDir = path.dirname(pkg.path);
  let builderConfig: BuilderConfig | undefined = pkg.packageJson.build;
  let configDir = rootDir;

  // If custom config path provided, use it directly
  if (customConfigPath) {
    try {
      const configPath = path.isAbsolute(customConfigPath) ? customConfigPath : path.join(rootDir, customConfigPath);
      log.debug(`Using custom config file: ${configPath}`);
      const config = await readConfig(path.basename(configPath), path.dirname(configPath));
      if (!config) {
        throw new Error(`Failed to read config file: ${configPath}`);
      }
      builderConfig = config.result as BuilderConfig;
      configDir = path.dirname(configPath);
    } catch (e) {
      log.error(`Failed to read custom config file: ${customConfigPath}`);
      throw e;
    }
  } else if (!builderConfig) {
    // if builder config is not found in the package.json, attempt to read `electron-builder.{yaml, yml, json, json5, toml}`
    // see also https://www.electron.build/configuration.html
    try {
      log.debug('Locating builder config file...');
      const config = await readBuilderConfig(getBuilderConfigCandidates(), rootDir);

      if (!config) {
        throw new Error();
      }

      log.debug(`Detected builder config file: ${config.configFile}`);
      builderConfig = config.result as BuilderConfig;
      configDir = rootDir;
    } catch (_e) {
      log.debug('Builder config file not found or invalid.');
      return undefined;
    }
  }

  // Resolve extends chain if present
  if (builderConfig.extends) {
    log.debug('Resolving extends chain...');
    builderConfig = await resolveExtendsChain(builderConfig, configDir);
    log.debug('Extends chain resolved');
  }

  return builderBuildInfo(builderConfig, pkg);
}

async function readBuilderConfig(fileCandidate: string[], projectDir: string) {
  for (const configFile of fileCandidate) {
    try {
      log.debug(`Attempting to read config file: ${configFile}...`);
      return await readConfig(configFile, projectDir);
    } catch (_e) {
      log.debug('unsuccessful');
    }
  }
  return undefined;
}
function getBuilderConfigCandidates(configFileName = 'electron-builder') {
  const exts = ['.yml', '.yaml', '.json', '.json5', '.toml', '.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
  return exts.reduce(
    (acc: string[], ext: string) => acc.concat([`${configFileName}${ext}`, `${configFileName}.config${ext}`]),
    [],
  );
}

function builderBuildInfo(builderConfig: BuilderConfig, pkg: NormalizedReadResult): BuilderBuildInfo {
  log.debug(`Builder configuration detected: \n${JSON.stringify(builderConfig)}`);
  const appName = pkg.packageJson.productName || builderConfig?.productName || pkg.packageJson.name || '';

  if (!appName) {
    throw new Error(APP_NAME_DETECTION_ERROR);
  }

  return {
    appName,
    config: builderConfig,
    isForge: false,
    isBuilder: true,
  };
}

/**
 * Resolve the extends chain for an electron-builder configuration
 * @param config - The initial configuration object
 * @param currentDir - Directory of the current config file (for resolving relative paths)
 * @param visited - Set of already visited config paths to detect circular references
 * @returns Merged configuration with all extended configs applied
 */
async function resolveExtendsChain(
  config: BuilderConfig,
  currentDir: string,
  visited: Set<string> = new Set(),
): Promise<BuilderConfig> {
  if (!config.extends) {
    return config;
  }

  const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];
  let mergedConfig: BuilderConfig = {};

  for (const extendPath of extendsList) {
    // Skip built-in presets (e.g., 'react-cra') or null - we don't need to resolve those
    // as electron-builder handles them internally at build time
    if (!extendPath || (!extendPath.startsWith('.') && !extendPath.startsWith('/'))) {
      log.debug(`Skipping built-in preset or invalid path: ${extendPath}`);
      continue;
    }

    const resolvedPath = path.resolve(currentDir, extendPath);

    // Detect circular references
    if (visited.has(resolvedPath)) {
      log.warn(`Circular extends reference detected: ${resolvedPath}`);
      continue;
    }
    visited.add(resolvedPath);

    try {
      const extendedResult = await readConfig(path.basename(resolvedPath), path.dirname(resolvedPath));
      if (extendedResult?.result) {
        const extendedConfig = extendedResult.result as BuilderConfig;
        // Recursively resolve extends in the parent config
        const resolvedParent = await resolveExtendsChain(extendedConfig, path.dirname(resolvedPath), visited);
        // Merge parent config (earlier configs get overwritten by later ones in the list,
        // but here we are iterating extendsList. Usually extends is applied sequentially.
        // However, standard intuitive inheritance is: base <- child.
        // If extends is an array: [base1, base2].
        // The electron-builder docs say: "The latter allows to mixin a config from multiple other configs, as if you Object.assign them"
        // So base2 overrides base1, and child overrides base2.
        // We are building 'mergedConfig' which represents the combination of all bases.
        mergedConfig = deepMerge(mergedConfig, resolvedParent);
      }
    } catch (error) {
      log.warn(`Failed to resolve extends config at ${resolvedPath}: ${(error as Error).message}`);
    }
  }

  // The current config takes precedence over extended configs
  // Remove the extends property from the merged result
  const { extends: _, ...currentWithoutExtends } = config;
  return deepMerge(mergedConfig, currentWithoutExtends);
}
