import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

import { createLogger } from '@wdio/native-utils';

const log = createLogger('tauri-service');

/**
 * Context for log file naming
 */
export interface LogWriterContext {
  /** Worker ID for multi-worker mode */
  workerId?: string;
  /** Spec name for identification */
  specName?: string;
}

/**
 * Log writer for capturing Tauri logs to files
 * Used in both WDIO test runner mode and standalone mode
 */
export class LogWriter {
  private logStream?: WriteStream;
  private logDir?: string;
  private logFile?: string;

  /**
   * Initialize log writer
   * Creates log directory and file stream
   * @param logDir - Full path to log directory
   * @param context - Optional context for filename (worker ID, spec name, etc.)
   */
  initialize(logDir: string, context?: LogWriterContext): void {
    this.logDir = logDir;

    // Create log directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file with timestamp and optional context
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const contextSuffix = context?.workerId ? `-${context.workerId}` : '';
    this.logFile = join(this.logDir, `wdio${contextSuffix}-${timestamp}.log`);

    // Create write stream
    this.logStream = createWriteStream(this.logFile, { flags: 'a' });
  }

  /**
   * Write log message to file
   */
  write(message: string, prefixedMessage?: string): void {
    if (!this.logStream) {
      // If not initialized, write to stdout instead
      console.log(message);
      return;
    }

    const timestamp = new Date().toISOString();
    // Use prefixedMessage if available, otherwise use regular message
    const logMessage = prefixedMessage || message;
    const formattedMessage = `${timestamp} INFO tauri-service:service: ${logMessage}\n`;
    this.logStream.write(formattedMessage);
  }

  /**
   * Close log stream
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = undefined;
    }
  }

  /**
   * Get log directory path
   */
  getLogDir(): string | undefined {
    return this.logDir;
  }

  /**
   * Get log file path
   */
  getLogFile(): string | undefined {
    return this.logFile;
  }
}

// Singleton instance
let logWriter: LogWriter | undefined;

/**
 * Get or create log writer
 */
export function getLogWriter(): LogWriter {
  if (!logWriter) {
    logWriter = new LogWriter();
  }
  return logWriter;
}

/**
 * Check if log writer is initialized
 */
export function isLogWriterInitialized(): boolean {
  return !!logWriter?.getLogFile();
}

/**
 * Close the log writer and release resources
 */
export function closeLogWriter(): void {
  if (logWriter) {
    logWriter.close();
    logWriter = undefined;
    log.debug('Log writer closed');
  }
}
