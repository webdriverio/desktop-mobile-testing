// Based on @wdio_electron-utils/src/log.ts
import logger, { type Logger } from '@wdio/logger';
import debug from 'debug';

/**
 * Options for creating a logger
 */
export interface LoggerOptions {
  /**
   * Scope for the logger (e.g., 'electron-service', 'flutter-service')
   */
  scope: string;

  /**
   * Optional area within scope (e.g., 'launcher', 'service', 'bridge')
   */
  area?: string;
}

/**
 * Framework-agnostic logger factory
 * Creates scoped loggers that integrate with both @wdio/logger and debug
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Factory pattern with static methods is intentional for singleton-like behavior
export class LoggerFactory {
  private static cache = new Map<string, Logger>();

  /**
   * Create or retrieve cached logger
   *
   * @param options - Logger configuration
   * @returns Logger instance
   *
   * @example
   * ```typescript
   * const logger = LoggerFactory.create({
   *   scope: 'my-service',
   *   area: 'launcher'
   * });
   * logger.info('Service started');
   * ```
   */
  static create(options: LoggerOptions): Logger {
    const key = `${options.scope}:${options.area || ''}`;
    const cached = LoggerFactory.cache.get(key);
    if (cached) return cached;

    const areaSuffix = options.area ? `:${options.area}` : '';
    const debugInstance = debug(`${options.scope}${areaSuffix}`);

    // Handle CommonJS/ESM compatibility for @wdio/logger default export
    const createWdioLogger = (logger as unknown as { default: typeof logger }).default || logger;
    const wdioLogger = createWdioLogger(`${options.scope}${areaSuffix}`);

    // Wrap to integrate both loggers
    const wrapped = LoggerFactory.wrapLogger(wdioLogger, debugInstance);
    LoggerFactory.cache.set(key, wrapped);
    return wrapped;
  }

  /**
   * Clear the logger cache
   * Useful for testing or when you need to recreate loggers
   */
  static clearCache(): void {
    LoggerFactory.cache.clear();
  }

  /**
   * Wrap @wdio/logger with debug integration
   * The wrapped logger forwards to both @wdio/logger and debug
   */
  private static wrapLogger(wdioLogger: Logger, debugInstance: debug.Debugger): Logger {
    const wrapped: Logger = {
      ...wdioLogger,
      debug: (...args: unknown[]) => {
        // Always forward to @wdio/logger so WDIO runner captures debug logs in outputDir
        // This ensures logs appear in CI log artifacts, not only in live console
        try {
          (wdioLogger.debug as unknown as (...a: unknown[]) => void)(...args);
        } catch {
          console.log('🔍 DEBUG: Error in debug logger', args);
        }

        // Also forward to debug package for development
        if (typeof args.at(-1) === 'object') {
          if (args.length > 1) {
            debugInstance(args.slice(0, -1));
          }
          debugInstance('%O', args.at(-1));
        } else {
          debugInstance(args);
        }
      },
    };

    return wrapped;
  }
}

/**
 * Convenience function for creating Electron service loggers
 * Maintains backward compatibility with existing Electron code
 *
 * @param area - Optional area within electron-service scope
 * @returns Logger instance
 */
export function createElectronLogger(area?: string): Logger {
  return LoggerFactory.create({ scope: 'electron-service', area });
}
