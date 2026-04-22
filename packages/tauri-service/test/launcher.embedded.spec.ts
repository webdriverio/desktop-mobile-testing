import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/embeddedProvider.js', () => ({
  checkEmbeddedServerAlive: vi.fn(),
  startEmbeddedDriver: vi.fn(),
  stopEmbeddedDriver: vi.fn(),
  getEmbeddedPort: vi.fn().mockReturnValue(4445),
  isEmbeddedProvider: vi.fn().mockReturnValue(true),
}));

vi.mock('../src/diagnostics.js', () => ({
  diagnoseTauriEnvironment: vi.fn().mockResolvedValue([]),
}));

vi.mock('@wdio/native-utils', () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  formatDiagnosticResults: vi.fn(),
  isErr: vi.fn().mockReturnValue(false),
  isOk: vi.fn().mockReturnValue(true),
  Ok: (v: unknown) => ({ ok: true, value: v }),
  Err: (e: unknown) => ({ ok: false, error: e }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('../src/driverPool.js', () => ({
  DriverPool: class MockDriverPool {
    startDriver = vi.fn();
    stopDriver = vi.fn().mockResolvedValue(undefined);
    stopAll = vi.fn().mockResolvedValue(undefined);
    getStatus = vi.fn().mockReturnValue({ count: 0, running: false });
    getRunningPids = vi.fn().mockReturnValue([]);
  },
}));

vi.mock('../src/portManager.js', () => ({
  PortManager: class MockPortManager {
    allocatePortPair = vi.fn().mockResolvedValue({ port: 4444, nativePort: 4445 });
    allocatePorts = vi.fn().mockResolvedValue([{ port: 4444, nativePort: 4445 }]);
    allocatePort = vi.fn().mockResolvedValue(4444);
    clear = vi.fn();
  },
}));

vi.mock('../src/pathResolver.js', () => ({
  getTauriAppInfo: vi.fn().mockResolvedValue({ version: '1.0.0' }),
  getTauriBinaryPath: vi.fn().mockResolvedValue('/app/my-app'),
  getWebKitWebDriverPath: vi.fn().mockReturnValue('/usr/bin/WebKitWebDriver'),
}));

vi.mock('../src/driverManager.js', () => ({
  ensureTauriDriver: vi.fn().mockResolvedValue({ ok: true, value: { path: '/tauri-driver', method: 'found' } }),
  findTestRunnerBackend: vi.fn(),
}));

vi.mock('../src/edgeDriverManager.js', () => ({
  ensureMsEdgeDriver: vi.fn().mockResolvedValue({ ok: true, value: { method: 'found', driverVersion: '120' } }),
}));

vi.mock('../src/commands/triggerDeeplink.js', () => ({
  setEmbeddedModeInfo: vi.fn(),
  setCrabnebulaModeInfo: vi.fn(),
}));

vi.mock('../src/crabnebulaBackend.js', () => ({
  startTestRunnerBackend: vi.fn(),
  stopTestRunnerBackend: vi.fn().mockResolvedValue(undefined),
  waitTestRunnerBackendReady: vi.fn().mockResolvedValue(undefined),
}));

import { checkEmbeddedServerAlive, startEmbeddedDriver, stopEmbeddedDriver } from '../src/embeddedProvider.js';
import TauriLaunchService from '../src/launcher.js';

const APP_BINARY = '/app/my-app';
const EMBEDDED_PORT = 4445;

const stubDriverInfo = { proc: { pid: 123, kill: vi.fn() } as any, logHandlers: [] };
const stubConfig = { appBinaryPath: APP_BINARY, port: EMBEDDED_PORT, options: {} };
const stdCaps = [{ 'tauri:options': { application: APP_BINARY } }];

function createEmbeddedLauncher(): TauriLaunchService {
  const launcher = new TauriLaunchService(
    {},
    { 'tauri:options': { application: APP_BINARY } } as any,
    { maxInstances: 1 } as any,
  );
  (launcher as any).isEmbeddedMode = true;
  (launcher as any).perWorkerMode = false;
  return launcher;
}

describe('ensureEmbeddedServersHealthy', () => {
  let launcher: TauriLaunchService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(stopEmbeddedDriver).mockResolvedValue(undefined);
    launcher = createEmbeddedLauncher();
    (launcher as any).embeddedConfigs.set('0', stubConfig);
    (launcher as any).embeddedProcesses.set('0', stubDriverInfo);
  });

  it('does nothing when the server is reachable', async () => {
    vi.mocked(checkEmbeddedServerAlive).mockResolvedValue(true);

    await (launcher as any).ensureEmbeddedServersHealthy();

    expect(stopEmbeddedDriver).not.toHaveBeenCalled();
    expect(startEmbeddedDriver).not.toHaveBeenCalled();
  });

  it('stops the old process and starts a new one when the server is unreachable', async () => {
    const newInfo = { proc: { pid: 456 } as any, logHandlers: [] };
    vi.mocked(checkEmbeddedServerAlive).mockResolvedValue(false);
    vi.mocked(startEmbeddedDriver).mockResolvedValue(newInfo);

    await (launcher as any).ensureEmbeddedServersHealthy();

    expect(stopEmbeddedDriver).toHaveBeenCalledWith(stubDriverInfo);
    expect(startEmbeddedDriver).toHaveBeenCalledWith(APP_BINARY, EMBEDDED_PORT, {}, '0');
    expect((launcher as any).embeddedProcesses.get('0')).toBe(newInfo);
  });

  it('still restarts when stopEmbeddedDriver throws (process already dead)', async () => {
    const newInfo = { proc: { pid: 456 } as any, logHandlers: [] };
    vi.mocked(checkEmbeddedServerAlive).mockResolvedValue(false);
    vi.mocked(stopEmbeddedDriver).mockRejectedValue(new Error('No such process'));
    vi.mocked(startEmbeddedDriver).mockResolvedValue(newInfo);

    await expect((launcher as any).ensureEmbeddedServersHealthy()).resolves.toBeUndefined();
    expect(startEmbeddedDriver).toHaveBeenCalled();
    expect((launcher as any).embeddedProcesses.get('0')).toBe(newInfo);
  });

  it('throws SevereServiceError when restart fails', async () => {
    vi.mocked(checkEmbeddedServerAlive).mockResolvedValue(false);
    vi.mocked(startEmbeddedDriver).mockRejectedValue(new Error('Binary not found'));

    await expect((launcher as any).ensureEmbeddedServersHealthy()).rejects.toThrow(
      'Failed to restart embedded WebDriver on port 4445',
    );
  });

  it('restarts only the crashed instance when multiple instances are running', async () => {
    const config2 = { appBinaryPath: APP_BINARY, port: 4446, options: {} };
    const driverInfo2 = { proc: { pid: 789 } as any, logHandlers: [] };
    (launcher as any).embeddedConfigs.set('1', config2);
    (launcher as any).embeddedProcesses.set('1', driverInfo2);

    vi.mocked(checkEmbeddedServerAlive).mockImplementation(async (port) => port === 4446);
    const newInfo = { proc: { pid: 999 } as any, logHandlers: [] };
    vi.mocked(startEmbeddedDriver).mockResolvedValue(newInfo);

    await (launcher as any).ensureEmbeddedServersHealthy();

    expect(startEmbeddedDriver).toHaveBeenCalledOnce();
    expect(startEmbeddedDriver).toHaveBeenCalledWith(APP_BINARY, EMBEDDED_PORT, {}, '0');
    expect((launcher as any).embeddedProcesses.get('0')).toBe(newInfo);
    expect((launcher as any).embeddedProcesses.get('1')).toBe(driverInfo2);
  });

  it('does nothing when embeddedConfigs is empty', async () => {
    (launcher as any).embeddedConfigs.clear();

    await (launcher as any).ensureEmbeddedServersHealthy();

    expect(checkEmbeddedServerAlive).not.toHaveBeenCalled();
  });
});

describe('onWorkerStart — embedded health check guard', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs health check when isEmbeddedMode=true and perWorkerMode=false', async () => {
    vi.mocked(checkEmbeddedServerAlive).mockResolvedValue(true);
    const launcher = createEmbeddedLauncher();
    (launcher as any).embeddedConfigs.set('0', stubConfig);
    (launcher as any).embeddedProcesses.set('0', stubDriverInfo);

    await launcher.onWorkerStart('0-0', stdCaps as any);

    expect(checkEmbeddedServerAlive).toHaveBeenCalledWith(EMBEDDED_PORT, undefined);
  });

  it('skips health check when isEmbeddedMode=false', async () => {
    const launcher = createEmbeddedLauncher();
    (launcher as any).isEmbeddedMode = false;
    (launcher as any).embeddedConfigs.set('0', stubConfig);

    await launcher.onWorkerStart('0-0', stdCaps as any);

    expect(checkEmbeddedServerAlive).not.toHaveBeenCalled();
  });

  it('skips health check when perWorkerMode=true', async () => {
    const launcher = createEmbeddedLauncher();
    (launcher as any).perWorkerMode = true;
    (launcher as any).embeddedConfigs.set('0', stubConfig);

    await launcher.onWorkerStart('0-0', stdCaps as any);

    expect(checkEmbeddedServerAlive).not.toHaveBeenCalled();
  });
});
