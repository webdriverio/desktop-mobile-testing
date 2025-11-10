import type { LogLevel } from './logForwarder.js';
import { forwardLog } from './logForwarder.js';

export interface WebDriverLogEntry {
  level: string;
  message: string;
  timestamp: number;
  source?: string;
}

/**
 * Map WebDriver log levels to our log levels
 */
function mapWebDriverLogLevel(level: string): LogLevel {
  const upperLevel = level.toUpperCase();
  if (upperLevel === 'SEVERE') {
    return 'error';
  }
  if (upperLevel === 'WARNING') {
    return 'warn';
  }
  if (upperLevel === 'INFO') {
    return 'info';
  }
  if (upperLevel === 'DEBUG' || upperLevel === 'FINE' || upperLevel === 'FINER' || upperLevel === 'FINEST') {
    return 'debug';
  }
  // Default to info for unknown levels
  return 'info';
}

/**
 * Capture frontend console logs from WebDriver
 */
export async function captureFrontendLogs(
  browser: WebdriverIO.Browser,
  minLevel: LogLevel,
  instanceId?: string,
): Promise<void> {
  try {
    // Get logs from browser
    const logs = await browser.getLogs('browser');

    for (const logEntry of logs) {
      // Type assertion for WebDriver log entry structure
      const entry = logEntry as WebDriverLogEntry;
      const level = mapWebDriverLogLevel(entry.level);
      const message = entry.message || '';

      // Forward the log if it meets the minimum level requirement
      forwardLog('frontend', level, message, minLevel, instanceId);
    }
  } catch (error) {
    // getLogs may not be supported in all WebDriver implementations
    // Silently fail - this is expected in some scenarios
    if (error instanceof Error && error.message.includes('getLogs')) {
      // Expected - getLogs not supported
      return;
    }
    // Re-throw unexpected errors
    throw error;
  }
}

/**
 * Set up periodic frontend log capture
 * Returns a cleanup function to stop the interval
 */
export function setupPeriodicLogCapture(
  browser: WebdriverIO.Browser,
  minLevel: LogLevel,
  intervalMs: number,
  instanceId?: string,
): () => void {
  const intervalId = setInterval(async () => {
    try {
      await captureFrontendLogs(browser, minLevel, instanceId);
    } catch {
      // Ignore errors during periodic capture
      // They will be logged on next attempt
    }
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}
