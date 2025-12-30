import fs from 'node:fs';
import path from 'node:path';

/**
 * Read WDIO log files from output directory
 */
export function readWdioLogs(logBaseDir: string): string {
  if (!fs.existsSync(logBaseDir)) {
    return '';
  }

  // Check if there are .log files directly in the base directory (standalone mode)
  const directLogFiles = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.log'))
    .map((dirent) => dirent.name)
    .sort();

  if (directLogFiles.length > 0) {
    // Standalone mode: read log files directly from base directory
    let allLogs = '';
    for (const logFile of directLogFiles) {
      const logPath = path.join(logBaseDir, logFile);
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        allLogs += `${content}\n`;
      } catch {
        // Ignore read errors
      }
    }
    return allLogs;
  }

  // WDIO test runner mode: find the most recent log directory by modification time
  const logDirs = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => ({
      name: dirent.name,
      mtime: fs.statSync(path.join(logBaseDir, dirent.name)).mtime,
    }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) // Sort by modification time, newest first
    .map((dir) => dir.name);

  if (logDirs.length === 0) {
    return '';
  }

  // Read all log files from the most recent directory
  const logDir = path.join(logBaseDir, logDirs[0]);
  const logFiles = fs
    .readdirSync(logDir)
    .filter((file) => file.endsWith('.log'))
    .sort();

  let allLogs = '';
  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      allLogs += `${content}\n`;
    } catch {
      // Ignore read errors
    }
  }

  return allLogs;
}

/**
 * Find log entries matching a pattern
 */
export function findLogEntries(logs: string, pattern: string | RegExp): string[] {
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
  return logs.split('\n').filter((line) => regex.test(line));
}

/**
 * Assert log contains expected message
 */
export function assertLogContains(logs: string, expected: string | RegExp): void {
  const found = typeof expected === 'string' ? logs.includes(expected) : expected.test(logs);

  if (!found) {
    throw new Error(`Expected log message not found: ${expected}\n\nLogs:\n${logs.slice(0, 1000)}`);
  }
}

/**
 * Assert log does NOT contain a pattern (for testing filtering)
 */
export function assertLogDoesNotContain(logs: string, pattern: string | RegExp): void {
  const found = typeof pattern === 'string' ? logs.includes(pattern) : pattern.test(logs);

  if (found) {
    const matches = findLogEntries(logs, pattern);
    throw new Error(
      `Expected log pattern to be filtered out: ${pattern}\n\nFound ${matches.length} matches:\n${matches.slice(0, 5).join('\n')}`,
    );
  }
}
