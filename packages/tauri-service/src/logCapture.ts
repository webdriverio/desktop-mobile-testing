import { createInterface, type Interface as ReadlineInterface } from 'node:readline';
import type { Readable } from 'node:stream';

import { createLogger } from '@wdio/native-utils';

import { forwardLog, type LogLevel } from './logForwarder.js';
import { parseLogLine } from './logParser.js';
import type { TauriServiceOptions } from './types.js';

const log = createLogger('tauri-service', 'launcher');

export interface LogCaptureOptions {
  /** The stream to capture logs from (stdout or stderr) */
  stream: Readable | null;
  /** Identifier for logging purposes (e.g., 'embedded-4445', 'tauri-driver-0') */
  identifier: string;
  /** Service options controlling log capture behavior */
  options: TauriServiceOptions;
  /** Optional instance ID for multiremote support */
  instanceId?: string;
  /** Callback when startup is detected (tauri-driver mode) */
  onStartupDetected?: () => void;
  /** Callback when error is detected (tauri-driver mode) */
  onErrorDetected?: (message: string) => void;
}

/**
 * Create a log capture handler for a stream (stdout/stderr)
 * Parses log lines and forwards them to the appropriate sink (file or WDIO logger)
 *
 * This is used by both:
 * - embeddedProvider.ts (embedded WebDriver mode)
 * - driverProcess.ts (tauri-driver mode)
 *
 * @param options - Log capture configuration options
 * @returns ReadlineInterface for the stream, or undefined if stream is null
 */
export function createLogCapture(options: LogCaptureOptions): ReadlineInterface | undefined {
  const { stream, identifier, options: serviceOptions, instanceId, onStartupDetected, onErrorDetected } = options;

  if (!stream) {
    return undefined;
  }

  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  rl.on('line', (line: string) => {
    // Log raw output for debugging in tauri-driver mode
    if (onStartupDetected || onErrorDetected) {
      if (line.includes('tauri-driver started') || line.includes('listening on')) {
        onStartupDetected?.();
      }
      if (line.includes('can not listen')) {
        onErrorDetected?.(`Failed to bind: ${line}`);
      }
    }

    // Parse and forward log if capture is enabled
    const parsedLog = parseLogLine(line);
    if (parsedLog) {
      if (serviceOptions.captureBackendLogs && parsedLog.source !== 'frontend') {
        const minLevel = (serviceOptions.backendLogLevel ?? 'info') as LogLevel;
        forwardLog('backend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
      }
      if (serviceOptions.captureFrontendLogs && parsedLog.source === 'frontend') {
        const minLevel = (serviceOptions.frontendLogLevel ?? 'info') as LogLevel;
        forwardLog('frontend', parsedLog.level, parsedLog.message, minLevel, parsedLog.prefixedMessage, instanceId);
      }
    }
  });

  rl.on('error', (err) => {
    log.warn(`[${identifier}] Stream error: ${err.message}`);
  });

  return rl;
}
