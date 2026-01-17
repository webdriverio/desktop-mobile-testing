import type { BundlerConfig } from '@wdio/bundler';

const config: BundlerConfig = {
  esm: {
    input: 'src/index.ts',
    output: 'dist/esm/index.js',
    sourcemap: true,
  },
  cjs: {
    input: 'src/index.ts',
    output: 'dist/cjs/index.js',
    sourcemap: true,
  },
};

export default config;
