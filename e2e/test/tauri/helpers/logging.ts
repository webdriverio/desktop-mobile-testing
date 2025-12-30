import fs from 'node:fs';
import path from 'node:path';

/**
 * Read WDIO log files from output directory
 */
export function readWdioLogs(logBaseDir: string): string {
  if (!fs.existsSync(logBaseDir)) {
    console.log(`[DEBUG] Log base directory does not exist: ${logBaseDir}`);
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
    console.log(`[DEBUG] Reading logs directly from: ${logBaseDir}`);
    console.log(`[DEBUG] Found log files: ${directLogFiles.join(', ')}`);

    let allLogs = '';
    for (const logFile of directLogFiles) {
      const logPath = path.join(logBaseDir, logFile);
      try {
        const content = fs.readFileSync(logPath, 'utf8');
        allLogs += `${content}\n`;
        console.log(`[DEBUG] Read ${logFile}: ${content.length} chars`);
      } catch (error) {
        console.log(`[DEBUG] Failed to read ${logFile}: ${error}`);
      }
    }
    return allLogs;
  }

  // WDIO test runner mode: find the most recent log directory
  const logDirs = fs
    .readdirSync(logBaseDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .sort()
    .reverse();

  if (logDirs.length === 0) {
    console.log(`[DEBUG] No log directories or files found in: ${logBaseDir}`);
    return '';
  }

  console.log(`[DEBUG] Found log directories: ${logDirs.join(', ')}`);

  // Read all log files from the most recent directory
  const logDir = path.join(logBaseDir, logDirs[0]);
  const logFiles = fs
    .readdirSync(logDir)
    .filter((file) => file.endsWith('.log'))
    .sort();

  console.log(`[DEBUG] Reading logs from: ${logDir}`);
  console.log(`[DEBUG] Found log files: ${logFiles.join(', ')}`);

  let allLogs = '';
  for (const logFile of logFiles) {
    const logPath = path.join(logDir, logFile);
    try {
      const content = fs.readFileSync(logPath, 'utf8');
      allLogs += `${content}\n`;
      console.log(`[DEBUG] Read ${logFile}: ${content.length} chars`);
    } catch (error) {
      console.log(`[DEBUG] Failed to read ${logFile}: ${error}`);
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
