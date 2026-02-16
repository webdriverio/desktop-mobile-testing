import { createLogger } from './log.js';

export { createLogger };
export { getAppBuildInfo } from './appBuildInfo.js';
export { generateBinaryPaths, getBinaryPath } from './binaryPath.js';
export {
  type DiagnosticResult,
  diagnoseBinary,
  diagnoseDiskSpace,
  diagnoseDisplay,
  diagnoseLinuxDependencies,
  diagnosePlatform,
  diagnoseSharedLibraries,
  formatDiagnosticResults,
} from './diagnostics.js';
export { getElectronVersion } from './electronVersion.js';
export type { LogArea } from './log.js';
export {
  Err,
  isErr,
  isOk,
  map,
  mapErr,
  Ok,
  type Result,
  unwrap,
  unwrapOr,
  wrapAsync,
} from './result.js';
export { selectExecutable, validateBinaryPaths } from './selectExecutable.js';
export { waitUntilWindowAvailable } from './window.js';
