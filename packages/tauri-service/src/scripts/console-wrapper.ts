/**
 * Console wrapper script injected into browser.execute() context
 * This script wraps console methods to capture logs and forward them to Rust backend
 */

import { CONSOLE_WRAPPED_KEY, LOG_FRONTEND_COMMAND, PREFIXES } from '../constants/logging.js';

export const CONSOLE_WRAPPER_SCRIPT = `
// Console wrapper state - prevent double-wrapping using Symbol
(function() {
  'use strict';

  var CONSOLE_WRAPPED = Symbol.for('${CONSOLE_WRAPPED_KEY}');
  if (console[CONSOLE_WRAPPED]) return;

  if (typeof window === 'undefined' || !window.__TAURI__ || !window.__TAURI__.core || !window.__TAURI__.core.invoke) return;

  console[CONSOLE_WRAPPED] = true;

  var originalConsole = {
    log: console.log.bind(console),
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  var LogLevel = { Trace: 1, Debug: 2, Info: 3, Warn: 4, Error: 5 };
  var levelToString = {};
  levelToString[LogLevel.Trace] = 'trace';
  levelToString[LogLevel.Debug] = 'debug';
  levelToString[LogLevel.Info] = 'info';
  levelToString[LogLevel.Warn] = 'warn';
  levelToString[LogLevel.Error] = 'error';

  function forward(level, args) {
    var message = Array.from(args).map(function(arg) {
      return typeof arg === 'string' ? arg : JSON.stringify(arg);
    }).join(' ');

    var methodMap = {};
    methodMap[LogLevel.Trace] = 'log';
    methodMap[LogLevel.Debug] = 'debug';
    methodMap[LogLevel.Info] = 'info';
    methodMap[LogLevel.Warn] = 'warn';
    methodMap[LogLevel.Error] = 'error';
    var method = methodMap[level] || 'log';
    var originalMethod = originalConsole[method];

    if (originalMethod) {
      originalMethod.call(console, '${PREFIXES.frontend} ' + message);
    }

    var levelStr = levelToString[level] || 'info';
    var invokePromise, timeoutPromise;

    (function() {
      try {
        invokePromise = window.__TAURI__.core.invoke('${LOG_FRONTEND_COMMAND}', {
          message: message,
          level: levelStr
        });
        timeoutPromise = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Invoke timeout')); }, 5000);
        });
        Promise.race([invokePromise, timeoutPromise]);
      } catch (e) {}
    })();
  }

  try {
    Object.defineProperty(console, 'log', { value: function() { forward(LogLevel.Trace, arguments); }, writable: true, configurable: true });
    Object.defineProperty(console, 'debug', { value: function() { forward(LogLevel.Debug, arguments); }, writable: true, configurable: true });
    Object.defineProperty(console, 'info', { value: function() { forward(LogLevel.Info, arguments); }, writable: true, configurable: true });
    Object.defineProperty(console, 'warn', { value: function() { forward(LogLevel.Warn, arguments); }, writable: true, configurable: true });
    Object.defineProperty(console, 'error', { value: function() { forward(LogLevel.Error, arguments); }, writable: true, configurable: true });
  } catch (err) {
    originalConsole.warn('[WDIO Console Forwarding] Failed to override console methods:', err);
  }

  function cleanup() {
    try {
      Object.defineProperty(console, 'log', { value: originalConsole.log, writable: true, configurable: true });
      Object.defineProperty(console, 'debug', { value: originalConsole.debug, writable: true, configurable: true });
      Object.defineProperty(console, 'info', { value: originalConsole.info, writable: true, configurable: true });
      Object.defineProperty(console, 'warn', { value: originalConsole.warn, writable: true, configurable: true });
      Object.defineProperty(console, 'error', { value: originalConsole.error, writable: true, configurable: true });
      console[CONSOLE_WRAPPED] = undefined;
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);
    window.__wdioConsoleCleanup = cleanup;
  }
})();
`;
