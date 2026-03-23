import 'vitest';

interface CustomMatchers<R = unknown> {
  anyMockFunction(): R;
}

declare module 'vitest' {
  interface Assertion<T> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
