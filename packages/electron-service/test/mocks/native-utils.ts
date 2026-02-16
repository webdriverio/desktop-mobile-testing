// Comprehensive mock for @wdio/native-utils
import { vi } from 'vitest';

// Simple mock logger that matches the real logger interface
const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
});

// Mock createLogger to return a mock logger instance
// We don't need to track loggers since we're not asserting on them
export const createLogger = vi.fn(() => createMockLogger());

// Export mocks for native-utils functions used in tests
export const getBinaryPath = vi.fn();
export const getAppBuildInfo = vi.fn();
export const getElectronVersion = vi.fn();
export const waitUntilWindowAvailable = vi.fn();

// Diagnostics
export const diagnoseBinary = vi.fn();
export const diagnoseDiskSpace = vi.fn();
export const diagnoseDisplay = vi.fn();
export const diagnoseLinuxDependencies = vi.fn();
export const diagnosePlatform = vi.fn();
export const diagnoseSharedLibraries = vi.fn();
export const formatDiagnosticResults = vi.fn();

// Result types
export const Err = vi.fn();
export const Ok = vi.fn();
export const isErr = vi.fn();
export const isOk = vi.fn();
export const map = vi.fn();
export const mapErr = vi.fn();
export const unwrap = vi.fn();
export const unwrapOr = vi.fn();
export const wrapAsync = vi.fn();

// Select executable
export const selectExecutable = vi.fn();
export const validateBinaryPaths = vi.fn();
