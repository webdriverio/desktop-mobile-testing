import { createLogger } from './log.js';

export { createLogger };
export { readConfig } from './config/read.js';
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
export type { LogArea } from './log.js';
export { type NormalizedReadResult, readPackageUp, readPackageUpSync } from './package.js';
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
