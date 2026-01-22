/**
 * Logging-related constants for Tauri service
 */

// Internal marker used by Rust log_frontend command
export const FRONTEND_MARKER = '[WDIO-FRONTEND]' as const;

// User-facing log prefixes
export const PREFIXES = {
  frontend: '[Tauri:Frontend]' as const,
  backend: '[Tauri:Backend]' as const,
} as const;

// Plugin invoke command
export const LOG_FRONTEND_COMMAND = 'plugin:wdio|log_frontend' as const;

// Console wrapper state key
export const CONSOLE_WRAPPED_KEY = 'wdio:console-wrapped' as const;
