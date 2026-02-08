import { describe, expect, it } from 'vitest';
import { type ConsoleAPICalledEvent, parseConsoleEvent } from '../src/logParser.js';

describe('logParser', () => {
  describe('parseConsoleEvent', () => {
    it('should parse log event with string message', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'string', value: 'Test message' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result).toEqual({
        level: 'info',
        message: 'Test message',
        source: 'main',
        timestamp: 1234567890,
        stackTrace: undefined,
      });
    });

    it('should parse error event and map to error level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'error',
        args: [{ type: 'string', value: 'Error occurred' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'renderer');

      expect(result.level).toBe('error');
      expect(result.message).toBe('Error occurred');
      expect(result.source).toBe('renderer');
    });

    it('should parse warning event and map to warn level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'warning',
        args: [{ type: 'string', value: 'Warning message' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.level).toBe('warn');
    });

    it('should parse debug event and map to debug level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'debug',
        args: [{ type: 'string', value: 'Debug info' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.level).toBe('debug');
    });

    it('should parse trace event and map to debug level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'trace',
        args: [{ type: 'string', value: 'Trace info' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.level).toBe('debug');
    });

    it('should parse assert event and map to error level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'assert',
        args: [{ type: 'string', value: 'Assertion failed' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.level).toBe('error');
    });

    it('should parse info event and map to info level', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'info',
        args: [{ type: 'string', value: 'Info message' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.level).toBe('info');
    });

    it('should handle multiple args and join with space', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [
          { type: 'string', value: 'Message' },
          { type: 'number', value: 42 },
          { type: 'boolean', value: true },
        ],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('Message 42 true');
    });

    it('should handle undefined value', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'undefined' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('undefined');
    });

    it('should handle null value', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'object', subtype: 'null' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('null');
    });

    it('should handle object with description', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'object', description: 'Array(3)' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('Array(3)');
    });

    it('should handle object with subtype when no description', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'object', subtype: 'array' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('[array]');
    });

    it('should handle object with only type when no description or subtype', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [{ type: 'object' }],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('[object]');
    });

    it('should format stack trace when present', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'error',
        args: [{ type: 'string', value: 'Error with stack' }],
        executionContextId: 1,
        timestamp: 1234567890,
        stackTrace: {
          callFrames: [
            {
              functionName: 'testFunc',
              scriptId: '1',
              url: 'file:///test.js',
              lineNumber: 10,
              columnNumber: 5,
            },
            {
              functionName: '',
              scriptId: '2',
              url: 'file:///main.js',
              lineNumber: 20,
              columnNumber: 15,
            },
          ],
        },
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.stackTrace).toBe('  at testFunc (file:///test.js:10:5)\n  at <anonymous> (file:///main.js:20:15)');
    });

    it('should handle empty args array', () => {
      const event: ConsoleAPICalledEvent = {
        type: 'log',
        args: [],
        executionContextId: 1,
        timestamp: 1234567890,
      };

      const result = parseConsoleEvent(event, 'main');

      expect(result.message).toBe('');
    });

    it('should handle all console types', () => {
      const types: ConsoleAPICalledEvent['type'][] = [
        'log',
        'debug',
        'info',
        'error',
        'warning',
        'dir',
        'dirxml',
        'table',
        'trace',
        'clear',
        'startGroup',
        'startGroupCollapsed',
        'endGroup',
        'assert',
        'profile',
        'profileEnd',
        'count',
        'timeEnd',
      ];

      types.forEach((type) => {
        const event: ConsoleAPICalledEvent = {
          type,
          args: [{ type: 'string', value: 'test' }],
          executionContextId: 1,
          timestamp: 1234567890,
        };

        const result = parseConsoleEvent(event, 'main');
        expect(result).toBeDefined();
        expect(result.message).toBe('test');
      });
    });
  });
});
