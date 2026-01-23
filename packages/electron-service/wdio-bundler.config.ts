import type { BundlerConfig } from '@wdio/bundler';

const config: BundlerConfig = {
  transformations: [
    {
      type: 'injectDependency',
      options: {
        packageName: 'fast-copy',
        targetFile: 'src/service.ts',
        bundleRegExp: /export.*$/m,
        importName: '{ copy: fastCopy }',
        bundleReplace: (importName) => `const ${importName} = { default: index };`,
      },
    },
  ],
  cjs: {
    bundle: ['fast-copy'],
  },
};

export default config;
