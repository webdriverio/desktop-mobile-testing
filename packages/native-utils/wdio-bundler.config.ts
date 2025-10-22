import type { BundlerConfig } from '@wdio/bundler';

const config: BundlerConfig = {
  esm: {
    // External dependencies that should not be bundled
    // These are dynamically imported at runtime
    external: ['tsx/esm/api', 'esbuild'],
  },
  cjs: {
    external: ['tsx/esm/api', 'esbuild'],
  },
};

export default config;
