import type { BundlerConfig } from '@wdio/bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'injectDependency',
      options: {
        packageName: '@vitest/spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export\s*\{\s*([^}]+)\s*\}\s*;/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} = { $1 };`,
      },
    },
  ],
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
