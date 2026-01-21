import { createLogger } from '@wdio/native-utils';
import type { LogLevel } from './logForwarder.js';

const log = createLogger('tauri-service', 'service');

export interface ParsedLog {
  level: LogLevel;
  message: string;
  raw: string;
  source?: 'backend' | 'frontend';
  prefixedMessage?: string;
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
 * Extract prefix and source from a log line
 * Returns the prefix (e.g., [Tauri:Backend]) and source type
 */
function extractPrefixAndSource(line: string): { prefix: string | null; source: 'backend' | 'frontend' } {
  // Check for explicit Tauri prefixes (highest priority)
  if (/\[Tauri:Backend\]/i.test(line)) {
    return { prefix: '[Tauri:Backend]', source: 'backend' };
  }
  if (/\[Tauri:Frontend\]/i.test(line)) {
    return { prefix: '[Tauri:Frontend]', source: 'frontend' };
  }
  // Check for [frontend] target from Tauri log plugin
  if (/\[frontend\]/i.test(line)) {
    return { prefix: '[frontend]', source: 'frontend' };
  }

  // Check for raw frontend log from Rust listener
  // Format: "message" (JSON-quoted string without [Tauri:Frontend] prefix)
  // These come from eprintln!("{}") where {} is the event payload (JSON-serialized string)
  if (/^".*"$/.test(line.trim())) {
    return { prefix: '[Tauri:Frontend]', source: 'frontend' };
  }

  // backend logs get their prefix added in logForwarder.ts via formatLogMessage()
  return { prefix: null, source: 'backend' };
}

/**
 * Check if a log line is from tauri-driver (should be filtered out)
 */
function isTauriDriverLog(line: string): boolean {
  return TAURI_DRIVER_PATTERNS.some((pattern) => pattern.test(line));
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
 * Clean up log message by removing timestamps and app names
 * If line already has a prefix, we preserve it and just trim
 */
function cleanLogMessage(line: string, hasPrefix: boolean): string {
  if (hasPrefix) {
    return line.trim();
  }

  // Remove tauri-plugin-log format: [2026-01-19][15:09:22][appname][LEVEL]
  let cleaned = line.replace(/\[\d{4}-\d{2}-\d{2}\]\[\d{2}:\d{2}:\d{2}\]/g, '');
  cleaned = cleaned.replace(/\]\[tauri_[a-zA-Z0-9_]+\]/g, ']');

  // Remove simple_logger format: 2026-01-20T15:41:50.030Z INFO [appname]
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\s*/g, '');
  cleaned = cleaned.replace(/\[[a-zA-Z0-9_-]+\]\s*/g, '');

  return cleaned.trim();
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

  // Filter out lines that already have [Tauri:Frontend] prefix
  // These come from browser console logs captured by tauri-driver
  // We only want raw logs from Rust listener (without prefix)
  if (/\[Tauri:Frontend\]/.test(trimmedLine)) {
    return undefined;
  }

  // Extract prefix and source before cleaning
  const { prefix, source } = extractPrefixAndSource(trimmedLine);

  // Try to extract log level
  const level = extractLogLevel(trimmedLine);

  // If no level found, default to 'info' for Tauri app logs
  const logLevel: LogLevel = level ?? 'info';

  // Clean up the message
  // If line has a prefix, strip it first - we'll add it back via prefixedMessage
  const hasPrefix = prefix !== null;
  let cleanedMessage = hasPrefix
    ? trimmedLine.replace(/^\[Tauri:(Backend|Frontend)\]\s*/i, '')
    : cleanLogMessage(trimmedLine, hasPrefix);

  // For raw frontend logs (JSON-quoted strings from Rust listener),
  // strip the surrounding quotes
  // Format: [Tauri:Frontend] "message" or just "message" (raw from Rust)
  if (source === 'frontend') {
    const trimmed = cleanedMessage.trim();
    if (/^".*"$/.test(trimmed)) {
      cleanedMessage = trimmed.slice(1, -1);
    }
  }

  // If message is empty after cleaning, skip it
  if (!cleanedMessage) {
    return undefined;
  }

  // Build prefixed message if we have a prefix
  const prefixedMessage = prefix ? `${prefix} ${cleanedMessage}` : undefined;

  return {
    level: logLevel,
    message: cleanedMessage,
    raw: trimmedLine,
    source,
    prefixedMessage,
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
        .map((p) => `${p.source}:${p.level}:${p.message.substring(0, 30)}`)
        .join(', ')}`,
    );
  }

  return parsed;
}
