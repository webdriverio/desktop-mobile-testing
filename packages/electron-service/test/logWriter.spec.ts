import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStandaloneLogWriter, isStandaloneLogWriterInitialized, StandaloneLogWriter } from '../src/logWriter.js';

describe('logWriter', () => {
  const testLogDir = join(process.cwd(), 'test-logs');

  beforeEach(() => {
    // Clean up test log directory
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test log directory
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('StandaloneLogWriter', () => {
    it('should initialize with log directory', () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      expect(existsSync(testLogDir)).toBe(true);
      expect(writer.getLogDir()).toBe(testLogDir);
      expect(writer.getLogFile()).toBeDefined();

      writer.close();
    });

    it('should create log file with timestamp', () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      const logFile = writer.getLogFile();
      expect(logFile).toBeDefined();
      expect(logFile).toMatch(/wdio-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);

      writer.close();
    });

    it('should create nested directories recursively', () => {
      const nestedDir = join(testLogDir, 'nested', 'dirs');
      const writer = new StandaloneLogWriter();
      writer.initialize(nestedDir);

      expect(existsSync(nestedDir)).toBe(true);

      writer.close();
    });

    it('should write log messages to file', async () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      writer.write('Test message 1');
      writer.write('Test message 2');

      // Wait for writes to flush
      await new Promise((resolve) => setTimeout(resolve, 100));
      writer.close();

      const logFile = writer.getLogFile();
      expect(logFile).toBeDefined();
      const content = readFileSync(logFile!, 'utf-8');

      expect(content).toContain('Test message 1');
      expect(content).toContain('Test message 2');
    });

    it('should format log messages with timestamp and level', async () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      writer.write('Test message');

      // Wait for writes to flush
      await new Promise((resolve) => setTimeout(resolve, 100));
      writer.close();

      const logFile = writer.getLogFile();
      const content = readFileSync(logFile!, 'utf-8');

      expect(content).toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z INFO electron-service:service: Test message/,
      );
    });

    it('should write to stdout when not initialized', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const writer = new StandaloneLogWriter();

      writer.write('Test message');

      expect(consoleSpy).toHaveBeenCalledWith('Test message');

      consoleSpy.mockRestore();
    });

    it('should close stream properly', async () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      writer.write('Test message');

      // Wait for writes to flush
      await new Promise((resolve) => setTimeout(resolve, 100));
      writer.close();

      // Should be able to read file after closing
      const logFile = writer.getLogFile();
      expect(logFile).toBeDefined();
      const content = readFileSync(logFile!, 'utf-8');
      expect(content).toContain('Test message');
    });

    it('should handle multiple writes before closing', async () => {
      const writer = new StandaloneLogWriter();
      writer.initialize(testLogDir);

      for (let i = 0; i < 100; i++) {
        writer.write(`Message ${i}`);
      }

      // Wait for writes to flush
      await new Promise((resolve) => setTimeout(resolve, 100));
      writer.close();

      const logFile = writer.getLogFile();
      const content = readFileSync(logFile!, 'utf-8');
      const lines = content.split('\n').filter((line) => line.length > 0);

      expect(lines.length).toBe(100);
    });

    it('should return undefined for getLogDir before initialization', () => {
      const writer = new StandaloneLogWriter();
      expect(writer.getLogDir()).toBeUndefined();
    });

    it('should return undefined for getLogFile before initialization', () => {
      const writer = new StandaloneLogWriter();
      expect(writer.getLogFile()).toBeUndefined();
    });
  });

  describe('getStandaloneLogWriter', () => {
    it('should return singleton instance', () => {
      const writer1 = getStandaloneLogWriter();
      const writer2 = getStandaloneLogWriter();

      expect(writer1).toBe(writer2);
    });

    it('should create instance on first call', () => {
      const writer = getStandaloneLogWriter();
      expect(writer).toBeInstanceOf(StandaloneLogWriter);
    });
  });

  describe('isStandaloneLogWriterInitialized', () => {
    it('should return false when not initialized', () => {
      // Note: This test may be affected by singleton state from other tests
      // In a real scenario, we'd need to reset the singleton or use dependency injection
      expect(isStandaloneLogWriterInitialized()).toBe(false);
    });

    it('should return true when initialized', () => {
      const writer = getStandaloneLogWriter();
      writer.initialize(testLogDir);

      expect(isStandaloneLogWriterInitialized()).toBe(true);

      writer.close();
    });
  });
});
