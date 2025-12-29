import { createWriteStream, existsSync, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

/**
 * Log writer for standalone mode (when WDIO test runner is not available)
 */
export class StandaloneLogWriter {
  private logStream?: WriteStream;
  private logDir?: string;
  private logFile?: string;

  /**
   * Initialize log writer for standalone mode
   * Creates log directory and file stream
   * @param logDir - Full path to log directory
   */
  initialize(logDir: string): void {
    this.logDir = logDir;

    // Create log directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = join(this.logDir, `wdio-${timestamp}.log`);

    // Create write stream
    this.logStream = createWriteStream(this.logFile, { flags: 'a' });
  }

  /**
   * Write log message to file
   */
  write(message: string): void {
    if (!this.logStream) {
      // If not initialized, write to stdout instead
      console.log(message);
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} INFO electron-service:service: ${message}\n`;
    this.logStream.write(formattedMessage);
  }

  /**
   * Close log stream
   * Waits for the stream to finish writing before resolving
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.logStream) {
        this.logStream.end(() => {
          this.logStream = undefined;
          resolve();
        });
      } else {
        resolve();
      }
    });
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

// Singleton instance for standalone mode
let standaloneWriter: StandaloneLogWriter | undefined;

/**
 * Get or create standalone log writer
 */
export function getStandaloneLogWriter(): StandaloneLogWriter {
  if (!standaloneWriter) {
    standaloneWriter = new StandaloneLogWriter();
  }
  return standaloneWriter;
}

/**
 * Check if standalone log writer is initialized
 */
export function isStandaloneLogWriterInitialized(): boolean {
  return !!standaloneWriter?.getLogFile();
}
