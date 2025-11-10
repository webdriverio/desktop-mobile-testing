import type { LogLevel } from './logForwarder.js';

export interface ParsedLog {
  level: LogLevel;
  message: string;
  raw: string;
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
 * Clean up log message by removing timestamps and brackets
 */
function cleanLogMessage(line: string): string {
  // Remove common timestamp patterns: [2024-01-01T12:00:00Z] or [12:00:00]
  let cleaned = line.replace(/\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*[Z]?\]/g, '');
  // Remove brackets around log levels: [INFO] or [ERROR]
  cleaned = cleaned.replace(
    /\[(ERROR|WARN|INFO|DEBUG|TRACE|Error|Warn|Info|Debug|Trace|error|warn|info|debug|trace)\]/gi,
    '',
  );
  // Remove leading/trailing whitespace and colons
  cleaned = cleaned.trim().replace(/^:\s*/, '').trim();
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

  return {
    level: logLevel,
    message,
    raw: trimmedLine,
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

  return parsed;
}
