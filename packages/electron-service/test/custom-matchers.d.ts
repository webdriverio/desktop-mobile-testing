import 'vitest';

interface CustomMatchers<R = unknown> {
  anyMockFunction(): R;
}

declare module 'vitest' {
  interface Assertion<T = unknown> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

declare global {
  // eslint-disable-next-line no-var
  var wdioElectron: { execute: ReturnType<typeof import('vitest').vi.fn> };
  // eslint-disable-next-line no-var
  var mrBrowser: WebdriverIO.MultiRemoteBrowser;
}
