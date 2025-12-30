import type { LogLevel } from './logForwarder.js';

/**
 * CDP Runtime.RemoteObject type
 */
interface RemoteObject {
  type: 'object' | 'function' | 'undefined' | 'string' | 'number' | 'boolean' | 'symbol' | 'bigint';
  subtype?:
    | 'array'
    | 'null'
    | 'node'
    | 'regexp'
    | 'date'
    | 'map'
    | 'set'
    | 'weakmap'
    | 'weakset'
    | 'iterator'
    | 'generator'
    | 'error'
    | 'proxy'
    | 'promise'
    | 'typedarray'
    | 'arraybuffer'
    | 'dataview'
    | 'webassemblymemory'
    | 'wasmvalue';
  value?: unknown;
  description?: string;
  objectId?: string;
}

/**
 * CDP Runtime.StackTrace type
 */
interface StackTrace {
  callFrames: Array<{
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  }>;
  description?: string;
  parent?: StackTrace;
}

/**
 * CDP Runtime.ConsoleAPICalledEvent type
 */
export interface ConsoleAPICalledEvent {
  type:
    | 'log'
    | 'debug'
    | 'info'
    | 'error'
    | 'warning'
    | 'dir'
    | 'dirxml'
    | 'table'
    | 'trace'
    | 'clear'
    | 'startGroup'
    | 'startGroupCollapsed'
    | 'endGroup'
    | 'assert'
    | 'profile'
    | 'profileEnd'
    | 'count'
    | 'timeEnd';
  args: RemoteObject[];
  executionContextId: number;
  timestamp: number;
  stackTrace?: StackTrace;
}

/**
 * Parsed log structure
 */
export interface ParsedLog {
  level: LogLevel;
  message: string;
  source: 'main' | 'renderer';
  timestamp: number;
  stackTrace?: string;
}

/**
 * Map CDP console type to LogLevel
 */
function mapConsoleTypeToLogLevel(type: ConsoleAPICalledEvent['type']): LogLevel {
  switch (type) {
    case 'error':
    case 'assert':
      return 'error';
    case 'warning':
      return 'warn';
    case 'info':
      return 'info';
    case 'debug':
    case 'trace':
      return 'debug';
    default:
      return 'info';
  }
}

/**
 * Extract message text from CDP RemoteObject array
 */
function extractMessage(args: RemoteObject[]): string {
  return args
    .map((arg) => {
      // Handle primitive types with values
      if (arg.type === 'string' || arg.type === 'number' || arg.type === 'boolean') {
        return String(arg.value);
      }

      // Handle undefined and null
      if (arg.type === 'undefined') {
        return 'undefined';
      }
      if (arg.subtype === 'null') {
        return 'null';
      }

      // For objects, arrays, etc., use description if available
      if (arg.description) {
        return arg.description;
      }

      // Fallback to type/subtype label
      return arg.subtype ? `[${arg.subtype}]` : `[${arg.type}]`;
    })
    .join(' ');
}

/**
 * Format stack trace for logging
 */
function formatStackTrace(stackTrace: StackTrace): string {
  const frames = stackTrace.callFrames
    .map((frame) => {
      const funcName = frame.functionName || '<anonymous>';
      return `  at ${funcName} (${frame.url}:${frame.lineNumber}:${frame.columnNumber})`;
    })
    .join('\n');

  return frames;
}

/**
 * Parse CDP ConsoleAPICalledEvent into structured log
 *
 * @param event - CDP Runtime.consoleAPICalled event
 * @param source - Log source (main process or renderer)
 * @returns Parsed log object
 */
export function parseConsoleEvent(event: ConsoleAPICalledEvent, source: 'main' | 'renderer'): ParsedLog {
  const level = mapConsoleTypeToLogLevel(event.type);
  const message = extractMessage(event.args);
  const stackTrace = event.stackTrace ? formatStackTrace(event.stackTrace) : undefined;

  return {
    level,
    message,
    source,
    timestamp: event.timestamp,
    stackTrace,
  };
}
