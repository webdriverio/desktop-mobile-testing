// Based on @wdio_electron-utils/src/config/read.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Options for ConfigReader
 */
export interface ConfigReaderOptions<T = unknown> {
  /**
   * File patterns to search for (e.g., ['app.config.json', '.apprc'])
   * Will be checked in order until a file is found
   */
  filePatterns: string[];

  /**
   * Optional validation schema (Zod or similar)
   * If provided, will validate the parsed config
   */
  schema?: {
    parse: (data: unknown) => T;
  };

  /**
   * Whether to support config inheritance via "extends" field
   * @default false
   */
  extends?: boolean;
}

/**
 * Result of reading a config file
 */
export interface ConfigReadResult<T = unknown> {
  /**
   * Parsed configuration object
   */
  config: T;

  /**
   * Path to the config file that was read
   */
  configFile: string;
}

/**
 * Framework-agnostic configuration file reader
 * Supports JSON, JSON5, YAML, TOML, and JS/TS config files
 */
export class ConfigReader<T = unknown> {
  constructor(private options: ConfigReaderOptions<T>) {}

  /**
   * Find and read config file from project directory
   *
   * @param projectRoot - Root directory to search for config files
   * @returns Parsed configuration object and file path
   * @throws Error if no config file is found or parsing fails
   */
  async read(projectRoot: string): Promise<ConfigReadResult<T>> {
    // Find config file
    const configFile = await this.findConfigFile(projectRoot);

    // Read and parse
    const { result, configFile: foundFile } = await this.readConfigFile(configFile, projectRoot);

    // Handle inheritance if enabled
    let config = result;
    if (
      this.options.extends &&
      typeof config === 'object' &&
      config !== null &&
      config !== undefined &&
      'extends' in config
    ) {
      config = await this.mergeWithParent(config, projectRoot);
    }

    // Validate if schema provided
    if (this.options.schema) {
      config = this.options.schema.parse(config);
    }

    return {
      config: config as T,
      configFile: foundFile,
    };
  }

  /**
   * Find config file in project directory
   * Checks each pattern in order and returns the first one found
   */
  private async findConfigFile(projectRoot: string): Promise<string> {
    for (const pattern of this.options.filePatterns) {
      const fullPath = path.join(projectRoot, pattern);
      try {
        await fs.access(fullPath, fs.constants.R_OK);
        return fullPath;
      } catch {}
    }

    throw new Error(`No config file found. Looked for: ${this.options.filePatterns.join(', ')} in ${projectRoot}`);
  }

  /**
   * Read and parse config file based on extension
   * Supports: .js, .cjs, .mjs, .ts, .cts, .mts, .json, .json5, .yaml, .yml, .toml
   */
  private async readConfigFile(
    configFilePath: string,
    projectDir: string,
  ): Promise<{ result: unknown; configFile: string }> {
    await fs.access(configFilePath, fs.constants.R_OK);

    const ext = path.parse(configFilePath).ext;
    const extRegex = {
      js: /\.(c|m)?(j|t)s$/,
      json: /\.json(5)?$/,
      toml: /\.toml$/,
      yaml: /\.y(a)?ml$/,
    };

    let result: unknown;

    if (extRegex.js.test(ext)) {
      result = await this.readJsOrTsFile(configFilePath, ext);
    } else {
      const data = await fs.readFile(configFilePath, 'utf8');
      if (extRegex.json.test(ext)) {
        result = await this.parseJson5(data);
      } else if (extRegex.toml.test(ext)) {
        result = await this.parseToml(data);
      } else if (extRegex.yaml.test(ext)) {
        result = await this.parseYaml(data);
      }
    }

    return { result, configFile: path.relative(projectDir, configFilePath) };
  }

  /**
   * Read JavaScript or TypeScript config file
   */
  private async readJsOrTsFile(configFilePath: string, ext: string): Promise<unknown> {
    const configFilePathUrl = pathToFileURL(configFilePath).toString();
    let imported: Record<string, unknown> | undefined;

    // Handle TypeScript files with tsx
    if (ext.includes('ts')) {
      imported = await this.handleTypeScriptFile(configFilePath, configFilePathUrl, ext);
    }

    // Fallback to native dynamic import for JavaScript files or failed TypeScript imports
    if (!imported) {
      imported = (await import(configFilePathUrl)) as Record<string, unknown>;
    }

    // Handle different export patterns
    let readResult = imported.default;
    if (!readResult && typeof imported === 'object') {
      // For CJS files that use module.exports
      const keys = Object.keys(imported);
      if (keys.length > 0 && !keys.includes('default')) {
        readResult = imported;
      }
    }

    // Handle function exports
    if (typeof readResult === 'function') {
      readResult = readResult();
    }

    return Promise.resolve(readResult);
  }

  /**
   * Handle TypeScript file imports
   */
  private async handleTypeScriptFile(
    configFilePath: string,
    configFilePathUrl: string,
    ext: string,
  ): Promise<Record<string, unknown> | undefined> {
    // For .ts and .mts files, try tsx first
    if (ext === '.ts' || ext === '.mts') {
      try {
        // @ts-expect-error Dynamic import - tsx is external at runtime
        const tsxApi = (await import('tsx/esm/api')) as unknown as {
          tsImport: (url: string, parentURL: string) => Promise<Record<string, unknown>>;
        };
        return await tsxApi.tsImport(configFilePathUrl, import.meta.url);
      } catch {
        return undefined;
      }
    }

    // For .cts files, try to strip types and convert to JS
    if (ext === '.cts') {
      try {
        return await this.handleCTSFile(configFilePath);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Handle CommonJS TypeScript (.cts) files by stripping types with esbuild
   */
  private async handleCTSFile(configFilePath: string): Promise<Record<string, unknown>> {
    const esbuild = await import('esbuild');
    const { readFileSync, writeFileSync, unlinkSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');

    const sourceCode = readFileSync(configFilePath, 'utf8');
    const tempJsFile = path.join(tmpdir(), `temp-${Date.now()}.js`);

    try {
      // Use esbuild to transpile CTS to JS
      const result = await esbuild.transform(sourceCode, {
        loader: 'ts',
        target: 'node18',
        format: 'cjs',
        sourcefile: configFilePath,
      });

      // Write the transpiled JS to a temp file
      writeFileSync(tempJsFile, result.code);

      // Import the temp JS file
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const imported = require(tempJsFile);

      return imported;
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempJsFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Parse JSON5 (JSON with comments)
   */
  private async parseJson5(data: string): Promise<unknown> {
    const json5 = await import('json5');
    // JSON5 exports parse as default in ESM, but as a named export in CJS
    const parseJson = json5.parse || json5.default.parse;
    return parseJson(data);
  }

  /**
   * Parse TOML
   */
  private async parseToml(data: string): Promise<unknown> {
    return (await import('smol-toml')).parse(data);
  }

  /**
   * Parse YAML
   */
  private async parseYaml(data: string): Promise<unknown> {
    return (await import('yaml')).parse(data);
  }

  /**
   * Merge config with parent via "extends" field
   */
  private async mergeWithParent(config: unknown, projectRoot: string): Promise<unknown> {
    if (typeof config !== 'object' || config === null || config === undefined || !('extends' in config)) {
      return config;
    }

    const extendsPath = (config as { extends: string }).extends;
    const parentPath = path.resolve(projectRoot, extendsPath);

    // Read parent config
    const parentResult = await this.readConfigFile(parentPath, projectRoot);
    let parentConfig = parentResult.result;

    // Recursively merge if parent also extends
    if (
      typeof parentConfig === 'object' &&
      parentConfig !== null &&
      parentConfig !== undefined &&
      'extends' in parentConfig
    ) {
      parentConfig = await this.mergeWithParent(parentConfig, projectRoot);
    }

    // Merge configs (child overrides parent)
    return {
      ...(parentConfig as object),
      ...(config as object),
    };
  }
}
