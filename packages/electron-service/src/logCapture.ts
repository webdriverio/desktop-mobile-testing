import { createLogger } from '@wdio/native-utils';
import type { CDPSession, Browser as PuppeteerBrowser } from 'puppeteer-core';
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
export class LogCaptureManager {
  private mainProcessListener?: (event: unknown, sessionId?: string) => void;
  private rendererListeners: Map<string, (event: unknown, sessionId?: string) => void> = new Map();
  private rendererCdpSessions: Map<string, CDPSession> = new Map();
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
   * Initialize capture for renderer process console logs using Puppeteer
   */
  async captureRendererLogs(
    puppeteerBrowser: PuppeteerBrowser,
    options: LogCaptureOptions,
    instanceId?: string,
  ): Promise<void> {
    try {
      this.instanceId = instanceId;

      // Get all existing page targets (renderer windows)
      const targets = puppeteerBrowser.targets().filter((target) => target.type() === 'page');

      // Attach to existing targets
      for (const target of targets) {
        await this.attachToPuppeteerTarget(target, options, instanceId);
      }

      // Listen for new targets
      puppeteerBrowser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          await this.attachToPuppeteerTarget(target, options, instanceId);
        }
      });

      log.debug(`Renderer process log capture initialized${instanceId ? ` for instance ${instanceId}` : ''}`);
    } catch (error) {
      log.error('Failed to initialize renderer process log capture:', error);
    }
  }

  /**
   * Attach to a specific Puppeteer target to capture console logs
   */
  private async attachToPuppeteerTarget(
    target: import('puppeteer-core').Target,
    options: LogCaptureOptions,
    instanceId?: string,
  ): Promise<void> {
    try {
      const targetId = (target as unknown as { _targetId: string })._targetId;

      // Get CDP session for this target
      const cdpSession = await target.createCDPSession();

      // Enable Runtime domain to receive console events
      await cdpSession.send('Runtime.enable');

      // Create listener for console events from this target
      const listener = (event: unknown) => {
        const consoleEvent = event as ConsoleAPICalledEvent;
        const parsed = parseConsoleEvent(consoleEvent, 'renderer');

        // Check if we should log this level
        if (shouldLog(parsed.level, options.rendererLogLevel)) {
          forwardLog('renderer', parsed.level, parsed.message, options.rendererLogLevel, instanceId);
        }
      };

      // Attach listener to CDP session
      cdpSession.on('Runtime.consoleAPICalled', listener as (event: unknown, sessionId?: string) => void);

      // Store session and listener for cleanup
      this.rendererCdpSessions.set(targetId, cdpSession);
      this.rendererListeners.set(targetId, listener);

      log.debug(`Attached to renderer target ${targetId}${instanceId ? ` for instance ${instanceId}` : ''}`);
    } catch (error) {
      log.error(`Failed to attach to Puppeteer target:`, error);
    }
  }

  /**
   * Stop all log capture and clean up listeners
   */
  stopCapture(): void {
    try {
      // Remove main process listener
      if (this.cdpBridge && this.mainProcessListener) {
        this.cdpBridge.off('Runtime.consoleAPICalled', this.mainProcessListener);
        this.mainProcessListener = undefined;
      }

      // Remove renderer CDP sessions and listeners
      for (const [targetId, cdpSession] of this.rendererCdpSessions.entries()) {
        try {
          const listener = this.rendererListeners.get(targetId);
          if (listener) {
            cdpSession.off('Runtime.consoleAPICalled', listener);
          }
          cdpSession.detach().catch(() => {
            // Ignore detach errors
          });
        } catch {
          // Ignore cleanup errors for individual sessions
        }
      }
      this.rendererCdpSessions.clear();
      this.rendererListeners.clear();

      log.debug(`Log capture stopped${this.instanceId ? ` for instance ${this.instanceId}` : ''}`);
    } catch (error) {
      log.error('Error stopping log capture:', error);
    }

    this.cdpBridge = undefined;
    this.instanceId = undefined;
  }
}
