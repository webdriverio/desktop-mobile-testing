declare module '@wdio/spec-reporter';

declare module '@wdio/native-utils' {
  export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  }

  export function createLogger(name: string, scope?: string): Logger;
  export function waitUntilWindowAvailable(browser: WebdriverIO.Browser): Promise<void>;
}
