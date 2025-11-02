import path from 'node:path';
import type { Options } from '@wdio/types';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./test/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: process.env.TAURI_APP_PATH || './src-tauri/target/release/tauri-app-example',
      },
      'wdio:tauriServiceOptions': {
        appBinaryPath: process.env.TAURI_APP_BINARY_PATH || './src-tauri/target/release/tauri-app-example',
        tauriDriverPort: 4444,
        debug: process.env.DEBUG === 'true',
      },
    },
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: '',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  autoXvfb: true,
  services: [['@wdio/tauri-service', {}]],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
  tsConfigPath: path.join(__dirname, 'tsconfig.json'),
};
