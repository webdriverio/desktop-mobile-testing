import { createLogger } from '@wdio/native-utils';
import type { LogLevel } from './logForwarder.js';

const log = createLogger('tauri-service', 'service');

export interface ParsedLog {
  level: LogLevel;
  message: string;
  raw: string;
  source?: 'backend' | 'frontend';
}

/**
 * Patterns to match log levels in Rust log output
 */
const LOG_LEVEL_PATTERNS: Array<{ level: LogLevel; pattern: RegExp }> = [
  { level: 'error', pattern: /\b(ERROR|Error|error)\b/i },
  { level: 'warn', pattern: /\b(WARN|Warn|warn|WARNING|Warning|warning)\b/i },
  { level: 'info', pattern: /\b(INFO|Info|info)\b/i },
  { level: 'debug', pattern: /\b(DEBUG|Debug|debug)\b/i },
  { level: 'trace', pattern: /\b(TRACE|Trace|trace)\b/i },
];

/**
 * Patterns that indicate tauri-driver logs (should be filtered out)
 */
const TAURI_DRIVER_PATTERNS = [
  /tauri-driver/i,
  /listening on/i,
  /started successfully/i,
  /WebKitWebDriver/i,
  /native driver/i,
];

/**
 * Patterns that indicate frontend console logs (forwarded via log_frontend command)
 * These logs come through stdout but originate from the frontend.
 *
 * Frontend logs use target="frontend" and appear in the format:
 * [timestamp][time][frontend][LEVEL] message
 *
 * We identify frontend logs by checking for the [frontend] target.
 */
const FRONTEND_LOG_PATTERNS = [
  // Logs with target="frontend" from our custom log_frontend command
  /\[frontend\]/i,
  // Console log patterns from our test code - must contain "Frontend" keyword
  /\[Test\].*(Frontend|frontend)/i,
  // Frontend-specific patterns that wouldn't appear in Rust
  /console\.(log|info|warn|error|debug|trace)/i,
  // App initialization logs from HTML
  /\[App\]/i,
  // Window/DOM related logs
  /window\.|document\.|typeof window/i,
  // Frontend-specific error patterns
  /Uncaught|ReferenceError|TypeError.*window/i,
];

/**
 * Check if a log line is from tauri-driver (should be filtered out)
 */
function isTauriDriverLog(line: string): boolean {
  return TAURI_DRIVER_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Check if a log line is from the frontend (console logs forwarded via attachConsole)
 */
function isFrontendLog(line: string): boolean {
  // Check for explicit [Tauri:Frontend] prefix
  if (/\[Tauri:Frontend\]/i.test(line)) {
    return true;
  }
  // Check for [FRONTEND:LEVEL] markers
  return FRONTEND_LOG_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Extract log level from a log line
 */
function extractLogLevel(line: string): LogLevel | undefined {
  for (const { level, pattern } of LOG_LEVEL_PATTERNS) {
    if (pattern.test(line)) {
      return level;
    }
  }
  return undefined;
}

/**
 * Clean up log message by removing timestamps
 * Handles both tauri-plugin-log format: [timestamp][time][appname][LEVEL] message
 * And simple_logger format: 2026-01-20T15:41:50.030Z INFO  [tauri_e2e_app] message
 */
function cleanLogMessage(line: string): string {
  // If line has Tauri prefix or [frontend] target, preserve it entirely
  if (/\[Tauri:(Backend|Frontend)\]/.test(line) || /\[frontend\]/i.test(line)) {
    return line;
  }

  // Remove tauri-plugin-log timestamp patterns like [2026-01-19][15:09:22]
  let cleaned = line.replace(/\[\d{4}-\d{2}-\d{2}\]\[\d{2}:\d{2}:\d{2}\]/g, '');
  // Remove app name pattern like [tauri_e2e_app] from tauri-plugin-log
  cleaned = cleaned.replace(/\]\[tauri_[a-zA-Z0-9_]+\]/g, ']');

  // Remove simple_logger format: 2026-01-20T15:41:50.030Z
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*/g, '');
  // Remove app name pattern like [tauri_e2e_app] from simple_logger
  cleaned = cleaned.replace(/\[[a-zA-Z0-9_-]+\]\s*/g, '');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  return cleaned;
}

/**
 * Parse a log line from stdout/stderr
 * Returns undefined if the line should be ignored (e.g., tauri-driver logs)
 */
export function parseLogLine(line: string): ParsedLog | undefined {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return undefined;
  }

  // Filter out tauri-driver logs
  if (isTauriDriverLog(trimmedLine)) {
    return undefined;
  }

  // Try to extract log level
  const level = extractLogLevel(trimmedLine);

  // If no level found, default to 'info' for Tauri app logs
  // (tauri-driver logs should have been filtered out already)
  const logLevel: LogLevel = level ?? 'info';

  // Clean up the message
  const message = cleanLogMessage(trimmedLine);

  // If message is empty after cleaning, skip it
  if (!message) {
    return undefined;
  }

  // Determine if this is a frontend log (console logs forwarded via attachConsole)
  const source = isFrontendLog(trimmedLine) ? 'frontend' : 'backend';

  return {
    level: logLevel,
    message,
    raw: trimmedLine,
    source,
  };
}

/**
 * Parse multiple log lines (handles multi-line logs)
 */
export function parseLogLines(lines: string): ParsedLog[] {
  const parsed: ParsedLog[] = [];
  const logLines = lines.split('\n');

  for (const line of logLines) {
    const parsedLog = parseLogLine(line);
    if (parsedLog) {
      parsed.push(parsedLog);
    }
  }

  if (parsed.length > 0) {
    log.debug(`[LOG-PARSER] Parsed ${parsed.length} log entries from ${logLines.length} lines`);
    log.debug(
      `[LOG-PARSER] Sample: ${parsed
        .slice(0, 3)
        .map((p) => p.source + ':' + p.level + ':' + p.message.substring(0, 30))
        .join(', ')}`,
    );
  }

  return parsed;
}
