import { createLogger } from '@wdio/native-utils';
import { getStandaloneLogWriter, isStandaloneLogWriterInitialized } from './logWriter.js';

const log = createLogger('tauri-service', 'service');

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
 * For multiremote, includes instance ID in the prefix (e.g., [Tauri:Backend:browserA])
 */
function formatLogMessage(source: 'backend' | 'frontend', message: string, instanceId?: string): string {
  const sourceLabel = source === 'frontend' ? 'Frontend' : 'Backend';
  const instanceLabel = instanceId ? `:${instanceId}` : '';
  return `[Tauri:${sourceLabel}${instanceLabel}] ${message}`;
}

/**
 * Transform prefixed message to include instance ID
 * Converts [Tauri:Backend] to [Tauri:Backend:browserA] for multiremote
 */
function transformPrefixedMessage(
  prefixedMessage: string,
  source: 'backend' | 'frontend',
  instanceId?: string,
): string {
  if (!instanceId) {
    return prefixedMessage;
  }

  const sourceLabel = source === 'frontend' ? 'Frontend' : 'Backend';
  const oldPrefix = `[Tauri:${sourceLabel}]`;
  const newPrefix = `[Tauri:${sourceLabel}:${instanceId}]`;

  if (prefixedMessage.startsWith(oldPrefix)) {
    return prefixedMessage.replace(oldPrefix, newPrefix);
  }

  return prefixedMessage;
}

/**
 * Forward a log message to WDIO logger or standalone file writer
 * @param source - Log source (backend or frontend)
 * @param level - Log level
 * @param message - Log message
 * @param minLevel - Minimum log level to capture
 * @param prefixedMessage - Optional pre-formatted message (takes precedence)
 * @param instanceId - Optional instance ID for multiremote (e.g., 'browserA')
 */
export function forwardLog(
  source: 'backend' | 'frontend',
  level: LogLevel,
  message: string,
  minLevel: LogLevel,
  prefixedMessage?: string,
  instanceId?: string,
): void {
  if (!shouldLog(level, minLevel)) {
    return;
  }

  // Transform prefixedMessage to include instance ID if provided
  const transformedPrefixed = prefixedMessage
    ? transformPrefixedMessage(prefixedMessage, source, instanceId)
    : undefined;
  const formattedMessage = transformedPrefixed || formatLogMessage(source, message, instanceId);

  log.debug(
    `[LOG-FORWARDER] source=${source}, level=${level}, instanceId=${instanceId ?? 'none'}, message=${message.substring(0, 50)}...`,
  );

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
