import { DirectEvalClient } from '../directEvalClient.js';
import { getCurrentWindowLabel, getSessionProvider } from '../window.js';

const directEvalClientCache = new WeakMap<WebdriverIO.Browser, { client: DirectEvalClient; port: number }>();

const DIRECT_EVAL_PORT_ENV_VAR = 'TAURI_WEBDRIVER_PORT';
const DIRECT_EVAL_DEFAULT_PORT = 4445;

function getDirectEvalPort(): number {
  const envPort = process.env[DIRECT_EVAL_PORT_ENV_VAR];
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!Number.isNaN(port)) return port;
  }
  return DIRECT_EVAL_DEFAULT_PORT;
}

function getOrCreateDirectEvalClient(browser: WebdriverIO.Browser, port: number): DirectEvalClient {
  const cached = directEvalClientCache.get(browser);
  if (cached && cached.port === port) return cached.client;
  const client = new DirectEvalClient(port);
  directEvalClientCache.set(browser, { client, port });
  return client;
}

export async function nativeScreenshot(
  browser: WebdriverIO.Browser,
  options?: { windowLabel?: string },
): Promise<Buffer> {
  const provider = getSessionProvider(browser);
  if (provider !== 'embedded') {
    throw new Error(
      `nativeScreenshot is only supported with the embedded provider (current: ${provider}). ` +
        'Configure driverProvider: "embedded" in your wdio:tauriServiceOptions.',
    );
  }
  const port = getDirectEvalPort();
  const client = getOrCreateDirectEvalClient(browser, port);
  const windowLabel = options?.windowLabel ?? getCurrentWindowLabel(browser);
  return client.nativeScreenshot({ windowLabel });
}
