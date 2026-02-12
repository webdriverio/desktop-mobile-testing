import { createLogger } from '@wdio/native-utils';
import { ensureTauriDriver } from './driverManager.js';
import { DriverProcess } from './driverProcess.js';
import { getWebKitWebDriverPath } from './pathResolver.js';
import type { TauriServiceOptions } from './types.js';
import { isErr } from './utils/result.js';

const log = createLogger('tauri-service');

export interface DriverInfo {
  process: DriverProcess;
  port: number;
  nativePort: number;
  mode: 'single' | 'worker' | 'multiremote';
  identifier: string;
}

export interface DriverStartConfig {
  mode: 'single' | 'worker' | 'multiremote';
  identifier: string;
  port: number;
  nativePort: number;
  options?: TauriServiceOptions;
  env?: NodeJS.ProcessEnv;
  instanceId?: string;
}

export class DriverPool {
  private drivers = new Map<string, DriverInfo>();
  private globalOptions: TauriServiceOptions;
  private nativeDriverPath?: string;

  constructor(globalOptions: TauriServiceOptions = {}, nativeDriverPath?: string) {
    this.globalOptions = globalOptions;
    this.nativeDriverPath = nativeDriverPath;
  }

  async startDriver(config: DriverStartConfig): Promise<DriverInfo> {
    const options = config.options ?? this.globalOptions;
    const driverResult = await ensureTauriDriver(options);

    if (isErr(driverResult)) {
      throw driverResult.error;
    }

    const tauriDriverPath = driverResult.value.path;
    const nativeDriverPath = this.nativeDriverPath ?? getWebKitWebDriverPath();

    if (nativeDriverPath) {
      log.debug(`[${config.identifier}] Using native driver: ${nativeDriverPath}`);
    }

    const driverProcess = new DriverProcess();

    await driverProcess.start({
      mode: config.mode,
      identifier: config.identifier,
      port: config.port,
      nativePort: config.nativePort,
      tauriDriverPath,
      nativeDriverPath,
      env: config.env,
      options,
      instanceId: config.instanceId,
    });

    const info: DriverInfo = {
      process: driverProcess,
      port: config.port,
      nativePort: config.nativePort,
      mode: config.mode,
      identifier: config.identifier,
    };

    this.drivers.set(config.identifier, info);

    log.info(`[${config.identifier}] Driver ready on port ${config.port} (native port: ${config.nativePort})`);
    return info;
  }

  async stopDriver(identifier: string): Promise<void> {
    const info = this.drivers.get(identifier);
    if (!info) {
      log.debug(`No driver found for ${identifier}`);
      return;
    }

    log.info(`Stopping driver [${identifier}]`);
    await info.process.stop();
    this.drivers.delete(identifier);
    log.debug(`Driver [${identifier}] stopped and cleaned up`);
  }

  async stopAll(): Promise<void> {
    const count = this.drivers.size;
    if (count === 0) {
      return;
    }

    log.info(`Stopping ${count} driver(s)...`);

    const stopPromises: Promise<void>[] = [];
    for (const [identifier, info] of this.drivers.entries()) {
      log.debug(`Stopping driver [${identifier}]...`);
      stopPromises.push(info.process.stop());
    }

    await Promise.all(stopPromises);
    this.drivers.clear();

    log.debug('All drivers stopped');
  }

  getDriver(identifier: string): DriverInfo | undefined {
    return this.drivers.get(identifier);
  }

  getDriverProcess(identifier: string): DriverProcess | undefined {
    return this.drivers.get(identifier)?.process;
  }

  getStatus(): { running: boolean; count: number; identifiers: string[] } {
    const identifiers = Array.from(this.drivers.keys());
    const runningCount = Array.from(this.drivers.values()).filter((info) => info.process.isRunning()).length;

    return {
      running: runningCount > 0,
      count: runningCount,
      identifiers,
    };
  }

  getRunningPids(): number[] {
    const pids: number[] = [];
    for (const info of this.drivers.values()) {
      if (info.process.isRunning() && info.process.proc?.pid) {
        pids.push(info.process.proc.pid);
      }
    }
    return pids;
  }
}
