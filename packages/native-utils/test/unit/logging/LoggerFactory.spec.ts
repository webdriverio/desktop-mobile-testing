import { beforeEach, describe, expect, it } from 'vitest';
import { createElectronLogger, LoggerFactory } from '../../../src/logging/LoggerFactory.js';

describe('LoggerFactory', () => {
  beforeEach(() => {
    // Clear cache before each test
    LoggerFactory.clearCache();
  });

  describe('create', () => {
    it('should create a logger with scope', () => {
      const logger = LoggerFactory.create({ scope: 'test-service' });

      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
    });

    it('should create a logger with scope and area', () => {
      const logger = LoggerFactory.create({
        scope: 'test-service',
        area: 'launcher',
      });

      expect(logger).toBeDefined();
    });

    it('should cache loggers', () => {
      const logger1 = LoggerFactory.create({ scope: 'test', area: 'area1' });
      const logger2 = LoggerFactory.create({ scope: 'test', area: 'area1' });

      // Should return the same instance
      expect(logger1).toBe(logger2);
    });

    it('should create different loggers for different scopes', () => {
      const logger1 = LoggerFactory.create({ scope: 'service1' });
      const logger2 = LoggerFactory.create({ scope: 'service2' });

      expect(logger1).not.toBe(logger2);
    });

    it('should create different loggers for different areas', () => {
      const logger1 = LoggerFactory.create({ scope: 'test', area: 'area1' });
      const logger2 = LoggerFactory.create({ scope: 'test', area: 'area2' });

      expect(logger1).not.toBe(logger2);
    });

    it('should handle logger without area', () => {
      const logger1 = LoggerFactory.create({ scope: 'test' });
      const logger2 = LoggerFactory.create({ scope: 'test', area: undefined });

      // Should return the same instance
      expect(logger1).toBe(logger2);
    });
  });

  describe('clearCache', () => {
    it('should clear the logger cache', () => {
      const logger1 = LoggerFactory.create({ scope: 'test' });

      LoggerFactory.clearCache();

      const logger2 = LoggerFactory.create({ scope: 'test' });

      // Should create a new instance after cache clear
      expect(logger1).not.toBe(logger2);
    });
  });

  describe('debug method', () => {
    it('should have a working debug method', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      // Should not throw
      expect(() => logger.debug('test message')).not.toThrow();
    });

    it('should handle object arguments', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      // Should not throw
      expect(() => logger.debug('test message', { data: 'value' })).not.toThrow();
    });

    it('should handle multiple arguments', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      // Should not throw
      expect(() => logger.debug('test', 'message', 'with', 'args')).not.toThrow();
    });
  });

  describe('other log methods', () => {
    it('should have working info method', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      expect(() => logger.info('info message')).not.toThrow();
    });

    it('should have working warn method', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      expect(() => logger.warn('warn message')).not.toThrow();
    });

    it('should have working error method', () => {
      const logger = LoggerFactory.create({ scope: 'test' });

      expect(() => logger.error('error message')).not.toThrow();
    });
  });

  describe('createElectronLogger', () => {
    it('should create logger with electron-service scope', () => {
      const logger = createElectronLogger();

      expect(logger).toBeDefined();
    });

    it('should create logger with electron-service scope and area', () => {
      const logger = createElectronLogger('launcher');

      expect(logger).toBeDefined();
    });

    it('should cache electron loggers', () => {
      const logger1 = createElectronLogger('service');
      const logger2 = createElectronLogger('service');

      expect(logger1).toBe(logger2);
    });

    it('should create different loggers for different areas', () => {
      const logger1 = createElectronLogger('launcher');
      const logger2 = createElectronLogger('service');

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('integration', () => {
    it('should work with multiple services', () => {
      const electronLogger = createElectronLogger('launcher');
      const flutterLogger = LoggerFactory.create({ scope: 'flutter-service', area: 'launcher' });
      const tauriLogger = LoggerFactory.create({ scope: 'tauri-service', area: 'launcher' });

      expect(electronLogger).toBeDefined();
      expect(flutterLogger).toBeDefined();
      expect(tauriLogger).toBeDefined();

      // All should be different instances
      expect(electronLogger).not.toBe(flutterLogger);
      expect(electronLogger).not.toBe(tauriLogger);
      expect(flutterLogger).not.toBe(tauriLogger);
    });

    it('should log without errors', () => {
      const logger = LoggerFactory.create({ scope: 'test-service', area: 'test' });

      expect(() => {
        logger.info('Starting test');
        logger.debug('Debug information', { test: true });
        logger.warn('Warning message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });
});
