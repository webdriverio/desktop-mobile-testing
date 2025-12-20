import { exec, execSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createLogger } from '@wdio/native-utils';
import type { TauriServiceOptions } from './types.js';

const execAsync = promisify(exec);

const log = createLogger('tauri-service');

export interface DriverInstallResult {
  success: boolean;
  path: string;
  method: 'found' | 'installed' | 'cached';
  error?: string;
}

/**
 * Check if cargo is available
 */
export function isCargoAvailable(): boolean {
  try {
    execSync('cargo --version', { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if tauri-driver is installed and accessible
 */
export function findTauriDriver(): string | undefined {
  const isWindows = process.platform === 'win32';

  try {
    const command = isWindows ? 'where tauri-driver' : 'which tauri-driver';
    const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    let path = result.trim().split('\n')[0]; // 'where' can return multiple paths

    // On Windows, convert Git Bash-style paths (/c/...) to Windows paths (C:\...)
    if (isWindows && path && path.startsWith('/')) {
      path = convertGitBashPathToWindows(path);
    }

    if (path && existsSync(path)) {
      return path;
    }
  } catch {
    // Not found in PATH
  }

  // Check common installation paths
  const commonPaths = isWindows
    ? [
        join(process.env.USERPROFILE || 'C:\\Users\\Default', '.cargo', 'bin', 'tauri-driver.exe'),
        'C:\\Users\\runneradmin\\.cargo\\bin\\tauri-driver.exe', // GitHub Actions default
      ]
    : [
        '/usr/local/bin/tauri-driver',
        '/opt/homebrew/bin/tauri-driver',
        join(process.env.HOME || '~', '.cargo/bin/tauri-driver'),
      ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return undefined;
}

/**
 * Install tauri-driver via cargo
 * Installs to the default cargo bin directory (~/.cargo/bin or %USERPROFILE%\.cargo\bin)
 */
export async function installTauriDriver(): Promise<string> {
  log.info('Installing tauri-driver via cargo...');
  log.warn('This may take several minutes on first run as cargo compiles from source.');

  // Install to default cargo bin directory (cargo handles this automatically)
  const cargoBinDir =
    process.platform === 'win32'
      ? join(process.env.USERPROFILE || 'C:\\Users\\Default', '.cargo', 'bin')
      : join(process.env.HOME || '~', '.cargo', 'bin');

  // Ensure cargo bin directory exists
  mkdirSync(cargoBinDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const proc = spawn('cargo', ['install', 'tauri-driver'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      // Log progress
      if (output.includes('Compiling') || output.includes('Downloading')) {
        log.debug(output.trim());
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      log.debug(output.trim());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const driverPath =
          process.platform === 'win32' ? join(cargoBinDir, 'tauri-driver.exe') : join(cargoBinDir, 'tauri-driver');

        if (existsSync(driverPath)) {
          // Ensure executable on Unix
          if (process.platform !== 'win32') {
            chmodSync(driverPath, 0o755);
          }
          log.info(`Successfully installed tauri-driver at: ${driverPath}`);
          resolve(driverPath);
        } else {
          reject(new Error('tauri-driver installation completed but binary not found'));
        }
      } else {
        reject(new Error(`cargo install failed with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn cargo install: ${error.message}`));
    });
  });
}

/**
 * Ensure tauri-driver is available, installing if necessary
 */
export async function ensureTauriDriver(options: TauriServiceOptions): Promise<DriverInstallResult> {
  // Check if explicitly provided
  if (options.tauriDriverPath) {
    if (existsSync(options.tauriDriverPath)) {
      return {
        success: true,
        path: options.tauriDriverPath,
        method: 'found',
      };
    }
    return {
      success: false,
      path: options.tauriDriverPath,
      method: 'found',
      error: `tauri-driver not found at provided path: ${options.tauriDriverPath}`,
    };
  }

  // Check if already installed
  const existingPath = findTauriDriver();
  if (existingPath) {
    log.debug(`Found tauri-driver at: ${existingPath}`);
    return {
      success: true,
      path: existingPath,
      method: 'found',
    };
  }

  // Auto-install if enabled
  if (options.autoInstallTauriDriver) {
    if (!isCargoAvailable()) {
      return {
        success: false,
        path: '',
        method: 'installed',
        error: 'Rust toolchain (cargo) not found. Please install Rust from https://rustup.rs/',
      };
    }

    try {
      const installedPath = await installTauriDriver();
      return {
        success: true,
        path: installedPath,
        method: 'installed',
      };
    } catch (error) {
      return {
        success: false,
        path: '',
        method: 'installed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Not found and auto-install disabled
  return {
    success: false,
    path: '',
    method: 'found',
    error:
      `tauri-driver not found. Install it with: cargo install tauri-driver\n` +
      `Or enable auto-installation by setting autoInstallTauriDriver: true in service options.`,
  };
}

/**
 * Detect the package manager on Linux systems
 * Returns the package manager name or 'unknown' if not detected
 * @public Exported for testing
 */
export async function detectPackageManager(): Promise<string> {
  const packageManagers = [
    { command: 'apt-get', name: 'apt' },
    { command: 'dnf', name: 'dnf' },
    { command: 'yum', name: 'yum' },
    { command: 'zypper', name: 'zypper' },
    { command: 'pacman', name: 'pacman' },
    { command: 'apk', name: 'apk' },
    { command: 'xbps-install', name: 'xbps' },
  ];

  for (const { command, name } of packageManagers) {
    try {
      await execAsync(`which ${command}`);
      return name;
    } catch {
      // Continue to next package manager
    }
  }

  return 'unknown';
}

/**
 * Get install command for webkit2gtk-driver based on package manager
 * @public Exported for testing
 */
export function getWebKitDriverInstallCommand(packageManager: string): string {
  const installCommands: Record<string, string> = {
    apt: 'sudo apt-get install -y webkit2gtk-driver',
    dnf: 'sudo dnf install -y webkit2gtk-driver',
    yum: 'sudo yum install -y webkit2gtk-driver',
    zypper: 'sudo zypper install -y webkit2gtk-driver',
    pacman: 'sudo pacman -S webkit2gtk-driver',
    apk: 'sudo apk add webkit2gtk-driver',
    xbps: 'sudo xbps-install -y webkit2gtk-driver',
  };

  return installCommands[packageManager] || installCommands.apt; // Default to apt-get
}

/**
 * Get WebKitWebDriver path with helpful error messages
 */
export async function ensureWebKitWebDriver(): Promise<{
  success: boolean;
  path?: string;
  error?: string;
  installInstructions?: string;
}> {
  if (process.platform !== 'linux') {
    return { success: true }; // Not needed on non-Linux
  }

  // Try to find WebKitWebDriver
  try {
    const result = execSync('which WebKitWebDriver', { encoding: 'utf8' });
    const path = result.trim();
    if (path && existsSync(path)) {
      return { success: true, path };
    }
  } catch {
    // Not in PATH
  }

  // Check common paths
  const commonPaths = [
    '/usr/bin/WebKitWebDriver',
    '/usr/local/bin/WebKitWebDriver',
    '/usr/lib/webkit2gtk-4.0/WebKitWebDriver',
    '/usr/lib/webkit2gtk-4.1/WebKitWebDriver',
  ];

  for (const path of commonPaths) {
    if (existsSync(path)) {
      return { success: true, path };
    }
  }

  // Detect package manager and provide specific instructions
  log.debug('WebKitWebDriver not found, detecting package manager...');
  const packageManager = await detectPackageManager();
  log.debug(`Detected package manager: ${packageManager}`);

  const installCommand = getWebKitDriverInstallCommand(packageManager);

  return {
    success: false,
    error: 'WebKitWebDriver not found',
    installInstructions: installCommand,
  };
}

/**
 * Convert Git Bash-style paths to Windows paths
 * Example: /c/Users/foo -> C:\Users\foo
 */
function convertGitBashPathToWindows(gitBashPath: string): string {
  // Match pattern like /c/Users/...
  const match = gitBashPath.match(/^\/([a-z])\/(.+)$/i);
  if (match) {
    const [, driveLetter, restOfPath] = match;
    return `${driveLetter.toUpperCase()}:\\${restOfPath.replace(/\//g, '\\')}`;
  }
  return gitBashPath;
}
