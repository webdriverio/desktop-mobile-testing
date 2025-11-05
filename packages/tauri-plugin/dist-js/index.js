/**
 * WebDriverIO Tauri Plugin - Frontend TypeScript/JavaScript API
 * Provides execute and mocking interfaces for testing
 */
import { invoke } from '@tauri-apps/api/core';
/**
 * Execute JavaScript code in the frontend context with access to Tauri APIs
 * The script will receive the Tauri APIs object as the first argument
 * @param script - JavaScript code to execute (function string without first parameter)
 * @param args - Arguments to pass to the script (after the Tauri APIs object)
 * @returns Result of the script execution
 */
export async function execute(script, args = []) {
  try {
    // Serialize args to pass them to the plugin
    const argsJson = JSON.stringify(args);
    // Wrap the script to inject the Tauri APIs object as the first argument
    // The script is already a function string without the first parameter (removed by service)
    // We need to wrap it to call it with window.__TAURI__ as the first argument
    // Note: We can't JSON.stringify window.__TAURI__ because it contains functions
    // Instead, we reference it directly in the wrapped script
    const wrappedScript = `
      (async () => {
        const tauri = window.__TAURI__;
        const __wdio_args = ${argsJson};
        // Execute the script as a function with tauri as first arg, then spread args
        return (${script})(tauri, ...__wdio_args);
      })()
    `.trim();
    // Call the plugin command to execute the wrapped script
    // Tauri v2 plugin commands use format: plugin:plugin-name|command-name
    const result = await invoke('plugin:wdio|execute', {
      script: wrappedScript,
      args: [],
    });
    return result;
  } catch (error) {
    throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Set a mock for a Tauri command
 * @param command - Command name to mock
 * @param config - Mock configuration
 */
export async function setMock(command, config) {
  try {
    await invoke('plugin:wdio|set-mock', {
      command,
      config,
    });
  } catch (error) {
    throw new Error(`Failed to set mock for ${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Get mock configuration for a command
 * @param command - Command name
 * @returns Mock configuration or null
 */
export async function getMock(command) {
  try {
    return await invoke('plugin:wdio|get-mock', { command });
  } catch (error) {
    throw new Error(`Failed to get mock for ${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Clear all mocks
 */
export async function clearMocks() {
  try {
    await invoke('plugin:wdio|clear-mocks');
  } catch (error) {
    throw new Error(`Failed to clear mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Reset all mocks
 */
export async function resetMocks() {
  try {
    await invoke('plugin:wdio|reset-mocks');
  } catch (error) {
    throw new Error(`Failed to reset mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Restore all mocks
 */
export async function restoreMocks() {
  try {
    await invoke('plugin:wdio|restore-mocks');
  } catch (error) {
    throw new Error(`Failed to restore mocks: ${error instanceof Error ? error.message : String(error)}`);
  }
}
/**
 * Initialize the plugin frontend API
 * This sets up window.wdioTauri for backward compatibility with execute injection pattern
 */
export function init() {
  if (typeof window === 'undefined') {
    return;
  }
  // Ensure window.__TAURI__ exists
  if (!window.__TAURI__) {
    console.error('window.__TAURI__ is not available. Make sure withGlobalTauri is enabled in tauri.conf.json');
    return;
  }
  // Expose wdioTauri on window object for backward compatibility
  window.wdioTauri = {
    execute,
    setMock,
    getMock,
    clearMocks,
    resetMocks,
    restoreMocks,
  };
}
// Auto-initialize when imported
if (typeof window !== 'undefined') {
  init();
}
