import type { BundlerConfig } from '@wdio/bundler';

const config: BundlerConfig = {
  browser: {
    entry: 'guest-js/index.ts',
    output: 'dist-js/index.js',
    globals: {
      '@wdio/native-spy': 'window.__native_spy__',
    },
    externals: ['@tauri-apps/api', '@tauri-apps/plugin-log'],
  },
};

export default config;
