import { createEnvironmentContext } from './config/envSchema.js';

/**
 * Main WDIO configuration that delegates to framework-specific configs
 * Based on the FRAMEWORK environment variable, this will load either:
 * - wdio.electron.conf.ts for Electron tests
 * - wdio.tauri.conf.ts for Tauri tests
 */

// Parse environment to determine framework
const envContext = createEnvironmentContext();

// Dynamically import the appropriate configuration
let config: Record<string, unknown>;

if (envContext.framework === 'tauri') {
  const { config: tauriConfig } = await import('./wdio.tauri.conf.js');
  config = tauriConfig;
} else {
  const { config: electronConfig } = await import('./wdio.electron.conf.js');
  config = electronConfig;
}

export { config };
