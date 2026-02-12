import { describe, expect, it } from 'vitest';
import {
  BackendError,
  BinaryNotFoundError,
  DriverError,
  ErrorCode,
  hasErrorCode,
  isTauriServiceError,
  PortAllocationError,
  TauriServiceError,
} from '../src/errors.js';

describe('Error types', () => {
  describe('TauriServiceError', () => {
    it('should create an error with code and message', () => {
      const error = new TauriServiceError('Test error', ErrorCode.VALIDATION_FAILED);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
      expect(error.name).toBe('TauriServiceError');
    });

    it('should include cause in stack trace', () => {
      const cause = new Error('Original error');
      const error = new TauriServiceError('Wrapped error', ErrorCode.DRIVER_INSTALL_FAILED, cause);
      expect(error.cause).toBe(cause);
      expect(error.stack).toContain('Caused by:');
    });

    it('should include context', () => {
      const context = { path: '/some/path', attempt: 3 };
      const error = new TauriServiceError('Context test', ErrorCode.BINARY_NOT_FOUND, undefined, context);
      expect(error.context).toEqual(context);
    });

    it('should create from static method', () => {
      const error = TauriServiceError.fromCode(ErrorCode.PORT_ALLOCATION_FAILED, 'Port allocation failed');
      expect(error.code).toBe(ErrorCode.PORT_ALLOCATION_FAILED);
      expect(error.message).toBe('Port allocation failed');
    });
  });

  describe('DriverError', () => {
    it('should create driver error', () => {
      const error = new DriverError('tauri-driver not found');
      expect(error.message).toBe('tauri-driver not found');
      expect(error.code).toBe(ErrorCode.DRIVER_NOT_FOUND);
      expect(error.name).toBe('DriverError');
    });
  });

  describe('BinaryNotFoundError', () => {
    it('should create binary not found error', () => {
      const error = new BinaryNotFoundError('tauri-driver');
      expect(error.message).toBe('tauri-driver not found');
      expect(error.code).toBe(ErrorCode.BINARY_NOT_FOUND);
      expect(error.context?.binaryName).toBe('tauri-driver');
      expect(error.name).toBe('BinaryNotFoundError');
    });
  });

  describe('PortAllocationError', () => {
    it('should create port allocation error', () => {
      const error = new PortAllocationError('Failed to allocate port 4444');
      expect(error.message).toBe('Failed to allocate port 4444');
      expect(error.code).toBe(ErrorCode.PORT_ALLOCATION_FAILED);
      expect(error.name).toBe('PortAllocationError');
    });
  });

  describe('BackendError', () => {
    it('should create backend error', () => {
      const error = new BackendError('test-runner-backend failed to start');
      expect(error.message).toBe('test-runner-backend failed to start');
      expect(error.code).toBe(ErrorCode.BACKEND_START_FAILED);
      expect(error.name).toBe('BackendError');
    });
  });

  describe('isTauriServiceError', () => {
    it('should return true for TauriServiceError', () => {
      const error = new TauriServiceError('test', ErrorCode.VALIDATION_FAILED);
      expect(isTauriServiceError(error)).toBe(true);
    });

    it('should return true for subclasses', () => {
      const error = new DriverError('test');
      expect(isTauriServiceError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('test');
      expect(isTauriServiceError(error)).toBe(false);
    });

    it('should return false for non-Error values', () => {
      expect(isTauriServiceError('error')).toBe(false);
      expect(isTauriServiceError(null)).toBe(false);
      expect(isTauriServiceError(undefined)).toBe(false);
    });
  });

  describe('hasErrorCode', () => {
    it('should return true when error has matching code', () => {
      const error = new DriverError('test');
      expect(hasErrorCode(error, ErrorCode.DRIVER_NOT_FOUND)).toBe(true);
    });

    it('should return false when error has different code', () => {
      const error = new DriverError('test');
      expect(hasErrorCode(error, ErrorCode.BINARY_NOT_FOUND)).toBe(false);
    });

    it('should return false for non-TauriServiceError', () => {
      const error = new Error('test');
      expect(hasErrorCode(error, ErrorCode.DRIVER_NOT_FOUND)).toBe(false);
    });
  });
});
