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
 * Map Electron log level to WDIO logger method
 */
function getLoggerMethod(logger: WdioLogger, level: LogLevel): (message: string, ...args: unknown[]) => void {
  switch (level) {
    case 'trace':
    case 'debug':
      return (message: string, ...args: unknown[]) => logger.debug(message, ...args);
    case 'info':
      return (message: string, ...args: unknown[]) => logger.info(message, ...args);
    case 'warn':
      return (message: string, ...args: unknown[]) => logger.warn(message, ...args);
    case 'error':
      return (message: string, ...args: unknown[]) => logger.error(message, ...args);
    default:
      return (message: string, ...args: unknown[]) => logger.info(message, ...args);
  }
}

/**
 * Format log message with context
 */
function formatLogMessage(source: 'main' | 'renderer', message: string, instanceId?: string): string {
  const sourceLabel = source === 'renderer' ? 'Renderer' : 'MainProcess';
  const prefix = instanceId ? `[Electron:${sourceLabel}:${instanceId}]` : `[Electron:${sourceLabel}]`;
  return `${prefix} ${message}`;
}

/**
 * Forward a log message to WDIO logger or standalone file writer
 */
export function forwardLog(
  source: 'main' | 'renderer',
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
    const logger = createLogger('electron-service', 'service');
    const loggerMethod = getLoggerMethod(logger, level);
    loggerMethod(formattedMessage);
  }
}
