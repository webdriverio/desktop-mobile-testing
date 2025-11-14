import { createLogger } from '@wdio/native-utils';
import { getStandaloneLogWriter, isStandaloneLogWriterInitialized } from './logWriter.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

type WdioLogger = ReturnType<typeof createLogger>;

/**
 * Log level priority (higher number = higher priority)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

/**
 * Check if a log level meets the minimum level requirement
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Map Tauri log level to WDIO logger method
 */
function getLoggerMethod(logger: WdioLogger, level: LogLevel): (...args: unknown[]) => void {
  switch (level) {
    case 'trace':
    case 'debug':
      return logger.debug.bind(logger);
    case 'info':
      return logger.info.bind(logger);
    case 'warn':
      return logger.warn.bind(logger);
    case 'error':
      return logger.error.bind(logger);
    default:
      return logger.info.bind(logger);
  }
}

/**
 * Format log message with context
 */
function formatLogMessage(source: 'backend' | 'frontend', message: string, instanceId?: string): string {
  const sourceLabel = source === 'frontend' ? 'Frontend' : 'Backend';
  const prefix = instanceId ? `[Tauri:${sourceLabel}:${instanceId}]` : `[Tauri:${sourceLabel}]`;
  return `${prefix} ${message}`;
}

/**
 * Forward a log message to WDIO logger or standalone file writer
 */
export function forwardLog(
  source: 'backend' | 'frontend',
  level: LogLevel,
  message: string,
  minLevel: LogLevel,
  instanceId?: string,
): void {
  if (!shouldLog(level, minLevel)) {
    return;
  }

  const formattedMessage = formatLogMessage(source, message, instanceId);

  // Check if we're in standalone mode (log writer initialized)
  if (isStandaloneLogWriterInitialized()) {
    const writer = getStandaloneLogWriter();
    writer.write(formattedMessage);
  } else {
    // Use WDIO logger (normal test runner mode)
    const logger = createLogger('tauri-service', 'service');
    const loggerMethod = getLoggerMethod(logger, level);
    loggerMethod(formattedMessage);
  }
}
