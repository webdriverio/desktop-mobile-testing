/**
 * @wdio/native-utils
 * Framework-agnostic utilities for WebdriverIO native desktop/mobile services
 */

/**
 * Package version
 */
export const VERSION = '1.0.0';

export * from './binary-detection/BinaryDetector.js';
// Binary Detection
export * from './binary-detection/types.js';
// Configuration
export * from './configuration/ConfigReader.js';
// Logging
export * from './logging/LoggerFactory.js';
// Platform
export * from './platform/PlatformUtils.js';
export * from './service-lifecycle/BaseLauncher.js';
export * from './service-lifecycle/BaseService.js';
// Service Lifecycle
export * from './service-lifecycle/types.js';
export * from './window-management/MultiRemoteWindowManager.js';
// Window Management
export * from './window-management/types.js';
export * from './window-management/WindowManager.js';
