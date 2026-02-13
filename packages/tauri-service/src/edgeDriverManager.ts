import { exec, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createLogger } from '@wdio/native-utils';
import { Err, Ok, type Result } from './utils/result.js';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const log = createLogger('tauri-service', 'launcher');

export interface EdgeDriverSuccess {
  driverPath?: string;
  driverVersion?: string;
  edgeVersion?: string;
  method?: 'found' | 'downloaded' | 'skipped';
}

export type EdgeDriverResult = Result<EdgeDriverSuccess, Error>;

/**
 * Detect WebView2 version from Tauri binary
 * Tauri apps use an embedded/fixed WebView2 runtime, not the system Edge
 */
export async function detectWebView2VersionFromBinary(binaryPath?: string): Promise<string | undefined> {
  if (process.platform !== 'win32' || !binaryPath) {
    return undefined;
  }

  try {
    // Use PowerShell to extract version info from the binary.
    // Pass the binary path as an argument to avoid interpolating it into the script.
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-Command', '(Get-Item $args[0]).VersionInfo.FileVersion', binaryPath],
      {
        encoding: 'utf8',
        timeout: 5000,
      },
    );

    const version = stdout.trim();
    if (version && /^\d+\.\d+\.\d+/.test(version)) {
      log.debug(`Detected WebView2 version ${version} from Tauri binary ${binaryPath}`);
      return version;
    }
  } catch (error) {
    log.debug(`Could not extract WebView2 version from binary: ${error}`);
  }

  return undefined;
}

/**
 * Detect Microsoft Edge version from Windows registry
 */
export async function detectEdgeVersion(): Promise<string | undefined> {
  if (process.platform !== 'win32') {
    return undefined;
  }

  try {
    // Try multiple registry paths for Edge
    const registryPaths = [
      // Stable Edge
      'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}',
      'HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{56EB18F8-B008-4CBD-B6D2-8C97FE7E9062}',
      // Current user
      'HKCU\\SOFTWARE\\Microsoft\\Edge\\BLBeacon',
    ];

    for (const regPath of registryPaths) {
      try {
        const { stdout } = await execAsync(`reg query "${regPath}" /v pv 2>nul`, {
          encoding: 'utf8',
        });

        const match = stdout.match(/pv\s+REG_SZ\s+([\d.]+)/);
        if (match) {
          log.debug(`Found Edge version ${match[1]} at ${regPath}`);
          return match[1];
        }
      } catch {
        // Try next path
      }
    }

    // Fallback: Try to get version from msedge.exe
    try {
      const { stdout } = await execAsync(
        `wmic datafile where name="C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe" get Version /value`,
        { encoding: 'utf8' },
      );
      const match = stdout.match(/Version=([\d.]+)/);
      if (match) {
        log.debug(`Found Edge version ${match[1]} from msedge.exe`);
        return match[1];
      }
    } catch {
      // Ignore
    }

    log.warn('Could not detect Edge version from registry or executable');
    return undefined;
  } catch (error) {
    log.error('Error detecting Edge version:', error);
    return undefined;
  }
}

/**
 * Extract major version from version string (e.g., "143.0.3650.139" -> "143")
 */
export function getMajorVersion(version: string): string {
  return version.split('.')[0];
}

/**
 * Check if msedgedriver.exe exists in PATH and get its version
 */
export async function findMsEdgeDriver(): Promise<{ path?: string; version?: string }> {
  if (process.platform !== 'win32') {
    return {};
  }

  try {
    // Try to find in PATH
    const { stdout: pathResult } = await execAsync('where msedgedriver.exe 2>nul', {
      encoding: 'utf8',
    });
    const driverPath = pathResult.trim().split('\n')[0];

    if (driverPath && existsSync(driverPath)) {
      // Get version
      try {
        const { stdout: versionOutput } = await execAsync(`"${driverPath}" --version`, {
          encoding: 'utf8',
          timeout: 5000,
        });
        const match = versionOutput.match(/MSEdgeDriver ([\d.]+)/);
        if (match) {
          log.debug(`Found msedgedriver ${match[1]} at ${driverPath}`);
          return { path: driverPath, version: match[1] };
        }
      } catch {
        // Could not get version
      }

      return { path: driverPath };
    }
  } catch {
    // Not found in PATH
  }

  return {};
}

/**
 * Get the correct driver version for a given Edge version from Microsoft's API
 */
async function getDriverVersionForEdge(edgeVersion: string): Promise<string> {
  const majorVersion = getMajorVersion(edgeVersion);
  const safeMajorVersion = majorVersion.replace(/\D/g, '');

  try {
    // Try to get the latest stable release for this major version
    const psCommand = `
      $ProgressPreference = 'SilentlyContinue'
      [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
      try {
        $response = Invoke-WebRequest -Uri 'https://msedgedriver.microsoft.com/LATEST_RELEASE_${safeMajorVersion}' -UseBasicParsing -TimeoutSec 10
        $response.Content.Trim()
      } catch {
        Write-Output ''
      }
    `;

    const response = await execFileAsync('powershell.exe', ['-Command', psCommand], {
      encoding: 'utf8',
      timeout: 15000,
    });

    const latestForMajor = response.stdout.trim();
    if (latestForMajor?.startsWith(safeMajorVersion)) {
      log.debug(`Found latest driver version ${latestForMajor} for Edge ${safeMajorVersion}`);
      return latestForMajor;
    }
  } catch (_error) {
    log.debug('Could not fetch latest driver version from Microsoft API');
  }

  // Fallback: try the exact version
  return edgeVersion;
}

/**
 * Download msedgedriver for a specific Edge version
 */
export async function downloadMsEdgeDriver(edgeVersion: string): Promise<string> {
  const majorVersion = getMajorVersion(edgeVersion);
  // Use random temp directory name to prevent symlink attacks
  const randomSuffix = randomBytes(8).toString('hex');
  const downloadDir = join(tmpdir(), 'msedgedriver', `${majorVersion}-${randomSuffix}`);
  const driverPath = join(downloadDir, 'msedgedriver.exe');

  log.info(`Downloading msedgedriver for Edge ${edgeVersion}...`);
  // Create directory with restrictive permissions (owner-only access)
  mkdirSync(downloadDir, { recursive: true, mode: 0o700 });

  // Get the correct driver version from Microsoft
  const driverVersion = await getDriverVersionForEdge(edgeVersion);

  // Create PowerShell script for downloading
  const psScript = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Faster downloads
$driverVersion = '${driverVersion}'
$edgeVersion = '${edgeVersion}'
$downloadDir = '${downloadDir.replace(/\\/g, '\\\\')}'
$driverPath = '${driverPath.replace(/\\/g, '\\\\')}'

try {
    # Force TLS 1.2 for older PowerShell versions
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    # Determine architecture
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }

    # Microsoft's CDN uses FULL version string
    # URL structure: https://msedgedriver.microsoft.com/{FULL_VERSION}/edgedriver_{ARCH}.zip
    $url = "https://msedgedriver.microsoft.com/$driverVersion/edgedriver_$arch.zip"

    Write-Host "Downloading Edge WebDriver $driverVersion (for Edge $edgeVersion) from: $url"
    $zipPath = Join-Path $downloadDir "edgedriver.zip"

    # Download using Invoke-WebRequest
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 60

    Write-Host "Download successful, extracting..."

    # Extract
    Expand-Archive -Path $zipPath -DestinationPath $downloadDir -Force
    Remove-Item $zipPath -ErrorAction SilentlyContinue

    # Verify extracted
    if (Test-Path $driverPath) {
        Write-Host "SUCCESS: msedgedriver $driverVersion downloaded to $driverPath"
    } else {
        throw "Downloaded and extracted but msedgedriver.exe not found at expected path: $driverPath"
    }

} catch {
    Write-Error "Error downloading msedgedriver: $_"
    exit 1
}
`;

  const psScriptPath = join(downloadDir, 'download-driver.ps1');
  writeFileSync(psScriptPath, psScript, 'utf8');

  try {
    // Execute PowerShell script
    const { stdout, stderr } = await execFileAsync(
      'powershell.exe',
      ['-ExecutionPolicy', 'Bypass', '-File', psScriptPath],
      {
        encoding: 'utf8',
        timeout: 60000, // 1 minute timeout
      },
    );

    log.debug('PowerShell output:', stdout);
    if (stderr) {
      log.debug('PowerShell stderr:', stderr);
    }

    if (existsSync(driverPath)) {
      log.info(`Successfully downloaded msedgedriver ${driverVersion} (for Edge ${edgeVersion}) to ${driverPath}`);
      return driverPath;
    }

    throw new Error('Download completed but driver not found');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(`Failed to download msedgedriver for Edge ${edgeVersion}:`, errorMsg);
    throw new Error(`Failed to download msedgedriver for Edge ${edgeVersion}: ${errorMsg}`);
  } finally {
    // Clean up the PowerShell script file
    try {
      if (existsSync(psScriptPath)) {
        unlinkSync(psScriptPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Ensure msedgedriver is available and matches Edge version
 * This is the main entry point for Edge driver management
 */
export async function ensureMsEdgeDriver(tauriBinaryPath?: string, autoDownload = true): Promise<EdgeDriverResult> {
  if (process.platform !== 'win32') {
    return Ok({ method: 'skipped' as const });
  }

  log.info('Checking Edge WebDriver compatibility...');

  let edgeVersion: string | undefined;

  if (tauriBinaryPath) {
    edgeVersion = await detectWebView2VersionFromBinary(tauriBinaryPath);
    if (edgeVersion) {
      log.info(`Detected WebView2 version from Tauri binary: ${edgeVersion}`);
    }
  }

  if (!edgeVersion) {
    edgeVersion = await detectEdgeVersion();
    if (edgeVersion) {
      log.info(`Detected system Edge version: ${edgeVersion}`);
      log.warn('Using system Edge version as fallback. This may not match the WebView2 version in your Tauri app.');
    }
  }

  if (!edgeVersion) {
    log.warn('Could not detect Edge/WebView2 version - skipping driver check');
    return Ok({ method: 'skipped' as const });
  }
  const edgeMajor = getMajorVersion(edgeVersion);

  const existing = await findMsEdgeDriver();
  if (existing.path && existing.version) {
    const driverMajor = getMajorVersion(existing.version);

    if (driverMajor === edgeMajor) {
      log.info(`✅ msedgedriver ${existing.version} matches Edge ${edgeVersion}`);
      return Ok({
        driverPath: existing.path,
        driverVersion: existing.version,
        edgeVersion,
        method: 'found' as const,
      });
    }

    log.warn(`❌ Version mismatch: msedgedriver ${existing.version} != Edge ${edgeVersion}`);
  }

  if (autoDownload) {
    try {
      log.info(`Attempting to download msedgedriver ${edgeVersion}...`);
      const downloadedPath = await downloadMsEdgeDriver(edgeVersion);

      process.env.PATH = `${join(downloadedPath, '..')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;

      log.info(`✅ Downloaded and configured msedgedriver ${edgeVersion}`);
      return Ok({
        driverPath: downloadedPath,
        driverVersion: edgeVersion,
        edgeVersion,
        method: 'downloaded' as const,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error('Failed to download msedgedriver:', errorMsg);

      return Err(
        new Error(
          `Failed to download msedgedriver: ${errorMsg}. Please manually install from https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/`,
        ),
      );
    }
  }

  return Err(
    new Error(
      `msedgedriver version mismatch. Edge: ${edgeVersion}, Driver: ${existing.version || 'unknown'}. Set autoDownloadEdgeDriver: true to auto-fix.`,
    ),
  );
}
