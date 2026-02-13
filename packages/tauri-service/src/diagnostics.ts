import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createLogger } from '@wdio/native-utils';
import { ensureTauriDriver, ensureWebKitWebDriver } from './driverManager.js';
import type { TauriServiceOptions } from './types.js';
import { isErr } from './utils/result.js';

const log = createLogger('tauri-service');

export interface DiagnosticResult {
  category: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  details?: string;
}

export async function diagnoseTauriEnvironment(
  binaryPath: string,
  options: TauriServiceOptions = {},
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  log.info('🔍 Running Tauri environment diagnostics...');

  results.push(...diagnosePlatform());
  results.push(...(await diagnoseBinary(binaryPath)));
  results.push(...diagnoseLinuxDependencies());
  results.push(...(await diagnoseDriver(options)));
  results.push(...(await diagnoseWebKit()));
  results.push(...diagnoseDiskSpace());

  log.info('✅ Diagnostics complete\n');
  return results;
}

function diagnosePlatform(): DiagnosticResult[] {
  return [
    {
      category: 'Platform',
      status: 'ok',
      message: `${process.platform} ${process.arch}`,
    },
    {
      category: 'Node Version',
      status: 'ok',
      message: process.version,
    },
    {
      category: 'Display',
      status: process.env.DISPLAY ? 'ok' : 'warn',
      message: process.env.DISPLAY || 'not set',
    },
    {
      category: 'XVFB',
      status: 'ok',
      message: process.env.XVFB_RUN || 'unknown',
    },
  ];
}

async function diagnoseBinary(binaryPath: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  try {
    const stats = statSync(binaryPath);
    const mode = (stats.mode & 0o777).toString(8);
    const isExecutable = (stats.mode & 0o111) !== 0;
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    results.push({
      category: 'Binary Permissions',
      status: isExecutable ? 'ok' : 'warn',
      message: mode,
      details: isExecutable ? 'Binary is executable' : 'Binary may not be executable',
    });

    results.push({
      category: 'Binary Size',
      status: 'ok',
      message: `${sizeMB} MB`,
    });

    if (process.platform === 'linux') {
      results.push(...(await diagnoseSharedLibraries(binaryPath)));
    }
  } catch (error) {
    results.push({
      category: 'Binary',
      status: 'error',
      message: `Failed to stat binary: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return results;
}

async function diagnoseSharedLibraries(binaryPath: string): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  try {
    const lddOutput = execSync(`ldd "${binaryPath}"`, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    const missing = lddOutput.split('\n').filter((line) => line.includes('not found'));

    if (missing.length > 0) {
      results.push({
        category: 'Shared Libraries',
        status: 'error',
        message: `${missing.length} missing libraries`,
        details: missing.map((l) => l.trim()).join('\n'),
      });
    } else {
      results.push({
        category: 'Shared Libraries',
        status: 'ok',
        message: 'All shared libraries found',
      });
    }

    const webkitLibs = lddOutput.split('\n').filter((line) => line.includes('webkit'));
    if (webkitLibs.length > 0) {
      results.push({
        category: 'WebKit Libraries',
        status: 'ok',
        message: `${webkitLibs.length} WebKit libraries found`,
        details: webkitLibs.map((l) => l.trim()).join('\n'),
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
      results.push({
        category: 'Shared Libraries',
        status: 'warn',
        message: 'ldd command not available - skipping check',
      });
    } else {
      results.push({
        category: 'Shared Libraries',
        status: 'warn',
        message: `Could not check: ${errorMessage}`,
      });
    }
  }

  return results;
}

function diagnoseLinuxDependencies(): DiagnosticResult[] {
  if (process.platform !== 'linux') {
    return [];
  }

  const results: DiagnosticResult[] = [];
  const requiredPackages = [
    'libgtk-3-0',
    'libgbm1',
    'libasound2',
    'libatk-bridge2.0-0',
    'libcups2',
    'libdrm2',
    'libxkbcommon0',
    'libxcomposite1',
    'libxdamage1',
    'libxrandr2',
  ];

  const missing: string[] = [];
  for (const pkg of requiredPackages) {
    try {
      execSync(`dpkg -s ${pkg} > /dev/null 2>&1`, { timeout: 1000 });
    } catch {
      missing.push(pkg);
    }
  }

  if (missing.length > 0) {
    results.push({
      category: 'Linux Dependencies',
      status: 'warn',
      message: `${missing.length} packages may be missing`,
      details: missing.join(', '),
    });
  } else {
    results.push({
      category: 'Linux Dependencies',
      status: 'ok',
      message: 'All required packages installed',
    });
  }

  return results;
}

async function diagnoseDriver(options: TauriServiceOptions): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const driverOptions: TauriServiceOptions = {
    autoInstallTauriDriver: options.autoInstallTauriDriver,
  };

  const driverResult = await ensureTauriDriver(driverOptions);

  if (isErr(driverResult)) {
    results.push({
      category: 'Tauri Driver',
      status: 'error',
      message: driverResult.error.message,
    });
  } else {
    results.push({
      category: 'Tauri Driver',
      status: 'ok',
      message: `${driverResult.value.path} (${driverResult.value.method})`,
    });
  }

  return results;
}

async function diagnoseWebKit(): Promise<DiagnosticResult[]> {
  if (process.platform !== 'linux') {
    return [];
  }

  const results: DiagnosticResult[] = [];
  const webkitResult = await ensureWebKitWebDriver();

  if (!isErr(webkitResult) && webkitResult.value.path) {
    results.push({
      category: 'WebKitWebDriver',
      status: 'ok',
      message: webkitResult.value.path,
    });
  } else if (isErr(webkitResult)) {
    results.push({
      category: 'WebKitWebDriver',
      status: 'warn',
      message: 'Not found',
      details: webkitResult.error.installInstructions,
    });
  }

  return results;
}

function diagnoseDiskSpace(): DiagnosticResult[] {
  const results: DiagnosticResult[] = [];

  try {
    const df = execSync('df -h . 2>&1 || true', { encoding: 'utf8', timeout: 2000 });
    const lines = df.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      if (parts.length >= 4) {
        results.push({
          category: 'Disk Space',
          status: 'ok',
          message: `${parts[2]} used, ${parts[3]} available`,
        });
      }
    }
  } catch {
    results.push({
      category: 'Disk Space',
      status: 'warn',
      message: 'Could not determine disk space',
    });
  }

  return results;
}

export function formatDiagnosticResults(results: DiagnosticResult[]): void {
  for (const result of results) {
    const icon = result.status === 'ok' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
    log.info(`${icon} ${result.category}: ${result.message}`);
    if (result.details) {
      log.debug(`   ${result.details}`);
    }
  }
}
