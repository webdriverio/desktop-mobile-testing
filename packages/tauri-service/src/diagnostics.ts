import {
  createLogger,
  type DiagnosticResult,
  diagnoseBinary,
  diagnoseDiskSpace,
  diagnoseDisplay,
  diagnoseLinuxDependencies,
  diagnosePlatform,
  formatDiagnosticResults,
  isErr,
} from '@wdio/native-utils';
import { ensureTauriDriver, ensureWebKitWebDriver } from './driverManager.js';
import type { TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service');

const TAURI_LINUX_PACKAGES = [
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

export type { DiagnosticResult };
export { formatDiagnosticResults };

export async function diagnoseTauriEnvironment(
  binaryPath: string,
  options: TauriServiceOptions = {},
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  log.info('Running Tauri environment diagnostics...');

  results.push(...diagnosePlatform());
  results.push(...diagnoseDisplay());
  results.push(...diagnoseBinary(binaryPath));
  results.push(...diagnoseLinuxDependencies(TAURI_LINUX_PACKAGES));
  results.push(...(await diagnoseDriver(options)));
  results.push(...(await diagnoseWebKit()));
  results.push(...diagnoseDiskSpace());

  log.info('Diagnostics complete\n');
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
