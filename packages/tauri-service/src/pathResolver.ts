import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from './log.js';
import type { TauriAppInfo } from './types.js';

const log = createLogger('utils');

/**
 * Get Tauri binary path for the given app directory
 */
export async function getTauriBinaryPath(
  appPath: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): Promise<string> {
  log.debug(`Resolving Tauri binary path for: ${appPath}`);
  log.debug(`Platform: ${platform}, Arch: ${arch}`);

  // If appPath points to a binary, resolve to the app directory
  let appDir: string;
  if (appPath.includes('target/release') || appPath.includes('target/debug')) {
    // Extract app directory from binary path
    const pathParts = appPath.split('/');
    const targetIndex = pathParts.indexOf('target');
    if (targetIndex > 0) {
      appDir = pathParts.slice(0, targetIndex).join('/');
    } else {
      appDir = appPath;
    }
  } else {
    appDir = appPath;
  }

  const appInfo = await getTauriAppInfo(appDir);

  // Platform-specific binary paths
  let binaryPath: string;

  if (platform === 'win32') {
    binaryPath = join(appInfo.targetDir, `${appInfo.name}.exe`);
  } else if (platform === 'darwin') {
    binaryPath = join(appInfo.targetDir, 'bundle', 'macos', `${appInfo.name}.app`);
  } else if (platform === 'linux') {
    binaryPath = join(appInfo.targetDir, appInfo.name.toLowerCase());
  } else {
    throw new Error(`Unsupported platform for Tauri: ${platform}`);
  }

  log.debug(`Resolved binary path: ${binaryPath}`);

  if (!existsSync(binaryPath)) {
    throw new Error(`Tauri binary not found: ${binaryPath}. Make sure the app is built.`);
  }

  return binaryPath;
}

/**
 * Get Tauri app information from tauri.conf.json
 */
export async function getTauriAppInfo(appPath: string): Promise<TauriAppInfo> {
  const tauriConfigPath = join(appPath, 'src-tauri', 'tauri.conf.json');

  if (!existsSync(tauriConfigPath)) {
    throw new Error(`Tauri config not found: ${tauriConfigPath}`);
  }

  try {
    const configContent = readFileSync(tauriConfigPath, 'utf-8');
    const config = JSON.parse(configContent);

    const productName = config.package?.productName || 'tauri-app';
    const version = config.package?.version || '1.0.0';
    const targetDir = join(appPath, 'src-tauri', 'target', 'release');

    return {
      name: productName,
      version,
      binaryPath: '', // Will be resolved by getTauriBinaryPath
      configPath: tauriConfigPath,
      targetDir,
    };
  } catch (error) {
    throw new Error(`Failed to parse Tauri config: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Check if Tauri app is built
 */
export async function isTauriAppBuilt(appPath: string): Promise<boolean> {
  try {
    const appInfo = await getTauriAppInfo(appPath);
    const targetDir = appInfo.targetDir;

    if (!existsSync(targetDir)) {
      return false;
    }

    // Check for platform-specific binary
    const platform = process.platform;
    let binaryPath: string;

    if (platform === 'win32') {
      binaryPath = join(targetDir, `${appInfo.name}.exe`);
    } else if (platform === 'darwin') {
      binaryPath = join(targetDir, 'bundle', 'macos', `${appInfo.name}.app`);
    } else if (platform === 'linux') {
      binaryPath = join(targetDir, appInfo.name.toLowerCase());
    } else {
      return false;
    }

    return existsSync(binaryPath);
  } catch (error) {
    log.debug(`Error checking if Tauri app is built: ${error}`);
    return false;
  }
}

/**
 * Get Tauri driver path
 */
export function getTauriDriverPath(): string {
  // Try to find tauri-driver in PATH
  try {
    const result = execSync('which tauri-driver', { encoding: 'utf8' });
    return result.trim();
  } catch {
    // Fallback to common installation paths
    const commonPaths = ['/usr/local/bin/tauri-driver', '/opt/homebrew/bin/tauri-driver', '~/.cargo/bin/tauri-driver'];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new Error('tauri-driver not found. Please install it with: cargo install tauri-driver');
  }
}
