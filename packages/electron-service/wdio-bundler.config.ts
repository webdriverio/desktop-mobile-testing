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
    {
      type: 'injectDependency',
      options: {
        packageName: '@wdio/native-spy',
        targetFile: 'src/mock.ts',
        bundleRegExp: /export\s*\{\s*([^}]+)\s*\}\s*;/,
        importName: 'spy',
        bundleReplace: (importName: string) => `const ${importName} = { $1 };`,
      },
    },
  ],
  cjs: {
    bundle: ['fast-copy'],
  },
};

export default config;
