export const config = {
  runner: 'local',
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: './tsconfig.json',
      transpileOnly: true,
    },
  },
  hostname: '127.0.0.1',
  port: 4444, // Default tauri-driver port
  path: '/',
  specs: ['./test/**/*.ts'],
  maxInstances: 1,
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: process.env.TAURI_APP_PATH || './src-tauri/target/release/tauri-basic-app',
      },
      'wdio:tauriServiceOptions': {
        // The path to the built Tauri app binary
        // This will be set dynamically based on the build output
        appBinaryPath: process.env.TAURI_APP_BINARY_PATH || './src-tauri/target/release/tauri-basic-app',
        tauriDriverPort: 4444,
        debug: process.env.DEBUG === 'true',
      },
    },
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [['@wdio/tauri-service', {}]], // Use the Tauri service
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
};
