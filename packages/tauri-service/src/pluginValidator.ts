import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service');

export interface PluginCheckResult {
  installed: boolean;
  message: string;
  details?: string;
}

/**
 * Check if tauri-plugin-automation is likely installed
 * This is a best-effort check by examining Cargo.toml
 *
 * @param srcTauriPath - Path to the src-tauri directory
 * @returns Result object with status and message
 */
export function checkAutomationPlugin(srcTauriPath: string): PluginCheckResult {
  const cargoPath = join(srcTauriPath, 'Cargo.toml');

  try {
    const cargoContent = readFileSync(cargoPath, 'utf8');

    // Check for plugin in dependencies
    const hasPlugin = cargoContent.includes('tauri-plugin-automation');

    if (hasPlugin) {
      return {
        installed: true,
        message: 'tauri-plugin-automation found in Cargo.toml',
      };
    }

    return {
      installed: false,
      message:
        'tauri-plugin-automation not found in Cargo.toml. ' + 'This plugin is required for CrabNebula macOS testing.',
      details:
        'Add it with: cd src-tauri && cargo add tauri-plugin-automation\n' +
        'See: https://docs.crabnebula.dev/tauri/webdriver/',
    };
  } catch (error) {
    return {
      installed: false,
      message: `Could not read Cargo.toml: ${error instanceof Error ? error.message : String(error)}`,
      details: 'Ensure the src-tauri path is correct and the file exists.',
    };
  }
}

/**
 * Warn about plugin requirements for macOS
 * Logs a warning if the automation plugin is not detected
 *
 * @param srcTauriPath - Path to the src-tauri directory
 */
export function warnAutomationPlugin(srcTauriPath: string): void {
  const result = checkAutomationPlugin(srcTauriPath);

  if (!result.installed) {
    log.warn(`⚠️  ${result.message}`);
    if (result.details) {
      log.warn(result.details);
    }
  } else {
    log.debug(`✅ ${result.message}`);
  }
}

/**
 * Validate that the app binary was built with debug assertions
 * This is a heuristic check - the automation plugin should only be included in debug builds
 *
 * @param binaryPath - Path to the Tauri binary
 * @returns Result object with status and message
 */
export function checkDebugBuild(binaryPath: string): PluginCheckResult {
  // Check if path contains "debug" - this is a simple heuristic
  const isDebugPath = binaryPath.includes('/debug/') || binaryPath.includes('\\debug\\');

  if (isDebugPath) {
    return {
      installed: true,
      message: 'App appears to be a debug build',
    };
  }

  return {
    installed: false,
    message: 'App does not appear to be a debug build',
    details:
      'The automation plugin should only be included in debug builds. ' +
      'Build with: cargo build or npm run tauri build -- --debug',
  };
}
