import { createLogger } from '@wdio/native-utils';
import type { ElectronCdpBridge } from './bridge.js';
import { forwardLog, type LogLevel, shouldLog } from './logForwarder.js';
import type { ConsoleAPICalledEvent } from './logParser.js';
import { parseConsoleEvent } from './logParser.js';

const log = createLogger('electron-service', 'service');

export interface LogCaptureOptions {
  captureMainProcessLogs: boolean;
  captureRendererLogs: boolean;
  mainProcessLogLevel: LogLevel;
  rendererLogLevel: LogLevel;
  logDir?: string;
}

/**
 * Manages CDP event listeners for console log capture
 */
interface TargetInfo {
  targetId: string;
  type: string;
}

export class LogCaptureManager {
  private mainProcessListener?: (event: unknown, sessionId?: string) => void;
  private rendererListeners: Map<string, (event: unknown, sessionId?: string) => void> = new Map();
  private targetCreatedListener?: (targetInfo: unknown) => void;
  private cdpBridge?: ElectronCdpBridge;
  private instanceId?: string;

  /**
   * Initialize capture for main process console logs
   */
  async captureMainProcessLogs(
    cdpBridge: ElectronCdpBridge,
    options: LogCaptureOptions,
    instanceId?: string,
  ): Promise<void> {
    try {
      this.cdpBridge = cdpBridge;
      this.instanceId = instanceId;

      // Enable Runtime domain
      await cdpBridge.send('Runtime.enable');

      // Create listener for console events
      this.mainProcessListener = (event: unknown) => {
        const parsed = parseConsoleEvent(event as ConsoleAPICalledEvent, 'main');

        // Check if we should log this level
        if (shouldLog(parsed.level, options.mainProcessLogLevel)) {
          forwardLog('main', parsed.level, parsed.message, options.mainProcessLogLevel, instanceId);
        }
      };

      // Attach listener to CDP bridge
      cdpBridge.on('Runtime.consoleAPICalled', this.mainProcessListener);

      log.debug(`Main process log capture initialized${instanceId ? ` for instance ${instanceId}` : ''}`);
    } catch (error) {
      log.error('Failed to initialize main process log capture:', error);
    }
  }

  /**
   * Initialize capture for renderer process console logs
   */
  async captureRendererLogs(
    cdpBridge: ElectronCdpBridge,
    options: LogCaptureOptions,
    instanceId?: string,
  ): Promise<void> {
    try {
      this.cdpBridge = cdpBridge;
      this.instanceId = instanceId;

      // Enable target discovery
      await cdpBridge.send('Target.setDiscoverTargets', { discover: true });

      // Get existing targets and attach to them
      const targetsResult = await cdpBridge.send('Target.getTargets', {});
      const targets = (targetsResult as { targetInfos?: TargetInfo[] })?.targetInfos || [];

      for (const targetInfo of targets) {
        if (targetInfo.type === 'page') {
          await this.attachToRendererTarget(targetInfo.targetId, options, instanceId);
        }
      }

      // Create listener for new targets
      this.targetCreatedListener = async (targetInfo: unknown) => {
        const info = targetInfo as TargetInfo;
        // Only attach to page targets (renderer windows)
        if (info.type === 'page') {
          await this.attachToRendererTarget(info.targetId, options, instanceId);
        }
      };

      // Attach listener for target creation
      cdpBridge.on('Target.targetCreated', this.targetCreatedListener);

      log.debug(`Renderer process log capture initialized${instanceId ? ` for instance ${instanceId}` : ''}`);
    } catch (error) {
      log.error('Failed to initialize renderer process log capture:', error);
    }
  }

  /**
   * Attach to a specific renderer target
   */
  private async attachToRendererTarget(
    targetId: string,
    options: LogCaptureOptions,
    instanceId?: string,
  ): Promise<void> {
    if (!this.cdpBridge) {
      return;
    }

    try {
      // Attach to the target
      const result = await this.cdpBridge.send('Target.attachToTarget', {
        targetId,
        flatten: true,
      });

      const sessionId = (result as { sessionId?: string })?.sessionId;

      if (!sessionId) {
        log.warn(`Failed to get sessionId for target ${targetId}`);
        return;
      }

      // Note: Runtime.enable was already called on the main session
      // In flatten mode, events from all sessions are forwarded with a sessionId parameter

      // Create listener for this specific renderer session
      const listener = (event: unknown, sid?: string) => {
        // Only process events from this specific session
        if (sid === sessionId) {
          const parsed = parseConsoleEvent(event as ConsoleAPICalledEvent, 'renderer');

          // Check if we should log this level
          if (shouldLog(parsed.level, options.rendererLogLevel)) {
            forwardLog('renderer', parsed.level, parsed.message, options.rendererLogLevel, instanceId);
          }
        }
      };

      // Attach listener
      this.cdpBridge.on('Runtime.consoleAPICalled', listener);

      // Store listener for cleanup
      this.rendererListeners.set(sessionId, listener);

      log.debug(
        `Attached to renderer target ${targetId} with session ${sessionId}${instanceId ? ` for instance ${instanceId}` : ''}`,
      );
    } catch (error) {
      log.error(`Failed to attach to renderer target ${targetId}:`, error);
    }
  }

  /**
   * Stop all log capture and clean up listeners
   */
  stopCapture(): void {
    if (!this.cdpBridge) {
      return;
    }

    try {
      // Remove main process listener
      if (this.mainProcessListener) {
        this.cdpBridge.off('Runtime.consoleAPICalled', this.mainProcessListener);
        this.mainProcessListener = undefined;
      }

      // Remove renderer listeners
      for (const listener of this.rendererListeners.values()) {
        this.cdpBridge.off('Runtime.consoleAPICalled', listener);
      }
      this.rendererListeners.clear();

      // Remove target created listener
      if (this.targetCreatedListener) {
        this.cdpBridge.off('Target.targetCreated', this.targetCreatedListener);
        this.targetCreatedListener = undefined;
      }

      log.debug(`Log capture stopped${this.instanceId ? ` for instance ${this.instanceId}` : ''}`);
    } catch (error) {
      log.error('Error stopping log capture:', error);
    }

    this.cdpBridge = undefined;
    this.instanceId = undefined;
  }
}
