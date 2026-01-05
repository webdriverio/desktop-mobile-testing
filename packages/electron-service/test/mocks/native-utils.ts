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
