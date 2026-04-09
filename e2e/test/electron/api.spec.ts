import { browser } from '@wdio/electron-service';
import { expect } from '@wdio/globals';

// Check if we're running in script mode
const isBinary = process.env.BINARY !== 'false';

// Helper function to get the expected app name from globalThis.packageJson
const getExpectedAppName = (): string => {
  // If running in binary mode, use the package name from globalThis
  if (isBinary && globalThis.packageJson?.name) {
    return globalThis.packageJson.name;
  }
  // In script mode, the app name will always be "Electron"
  return 'Electron';
};

const getExpectedAppVersion = async (): Promise<string> => {
  // If running in binary mode, use the package name from globalThis
  if (isBinary && globalThis.packageJson?.version) {
    return globalThis.packageJson.version;
  }
  // In script mode, the version should match the Electron version
  const electronVersion = await browser.electron.execute((_electron) => process.versions.electron);

  // Handle multiremote mode - take first result since all instances should have same version
  if (Array.isArray(electronVersion)) {
    return electronVersion[0];
  }

  return electronVersion;
};

describe('Electron APIs', () => {
  beforeEach(async () => {
    // Reset app name to original value to ensure test isolation
    const expectedName = getExpectedAppName();
    await browser.electron.execute((electron, appName) => electron.app.setName(appName), expectedName);
  });

  it('should retrieve the app name through the electron API', async () => {
    const appName = await browser.electron.execute((electron) => electron.app.getName());
    const expectedName = getExpectedAppName();

    expect(appName).toBe(expectedName);
  });

  it('should retrieve the app version through the electron API', async () => {
    const appVersion = await browser.electron.execute((electron) => electron.app.getVersion());
    const expectedVersion = await getExpectedAppVersion();

    expect(appVersion).toBe(expectedVersion);
  });

  describe('execute', () => {
    it('should execute a function', async () => {
      expect(await browser.electron.execute(() => 1 + 2 + 3)).toEqual(6);
    });

    it('should execute a function in the electron main process', async () => {
      const result = await browser.electron.execute(
        (electron, a, b, c) => {
          const version = electron.app.getVersion();
          return [version, a + b + c];
        },
        1,
        2,
        3,
      );

      // Check that we get a valid version (don't compare exact version)
      expect(result[0]).toMatch(/^\d+\.\d+\.\d+/);
      expect(result[1]).toEqual(6);
    });

    it('should execute a stringified function', async () => {
      await expect(browser.electron.execute('() => 1 + 2 + 3')).resolves.toEqual(6);
    });

    it('should execute a stringified function in the electron main process', async () => {
      // Don't check for specific version, just verify it returns a valid semver string
      await expect(browser.electron.execute('(electron) => electron.app.getVersion()')).resolves.toMatch(
        /^\d+\.\d+\.\d+/,
      );
    });

    describe('execute - different script types', () => {
      it('should execute function with args (with-args branch)', async () => {
        const result = await browser.electron.execute(
          (electron, arg1, arg2) => {
            return { appName: electron.app.getName(), arg1, arg2 };
          },
          'first',
          'second',
        );
        expect(result.appName).toBeDefined();
        expect(result.arg1).toBe('first');
        expect(result.arg2).toBe('second');
      });

      it('should execute statement-style string (return statement)', async () => {
        const result = await browser.electron.execute('return 42');
        expect(result).toBe(42);
      });

      it('should execute expression-style string', async () => {
        const result = await browser.electron.execute('1 + 2 + 3');
        expect(result).toBe(6);
      });

      it('should execute string with variable declaration', async () => {
        const result = await browser.electron.execute(`
          const x = 10;
          const y = 20;
          return x + y;
        `);
        expect(result).toBe(30);
      });

      it('should execute function without args', async () => {
        const result = await browser.electron.execute((electron) => {
          return { name: electron.app.getName() };
        });
        expect(result.name).toBeDefined();
      });

      it('should execute async function with args', async () => {
        const result = await browser.electron.execute(async (electron, value) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { received: value, appName: electron.app.getName() };
        }, 'async-test');
        expect(result.received).toBe('async-test');
        expect(result.appName).toBeDefined();
      });
    });

    describe('workaround for TSX issue', () => {
      // Tests for the following issue - can be removed when the TSX issue is resolved
      // https://github.com/webdriverio-community/wdio-electron-service/issues/756
      // https://github.com/privatenumber/tsx/issues/113
      it('should handle executing a function which declares a function', async () => {
        expect(
          await browser.electron.execute(() => {
            function innerFunc() {
              return 'executed inner function';
            }
            return innerFunc();
          }),
        ).toEqual('executed inner function');
      });

      it('should handle executing a function which declares an arrow function', async () => {
        expect(
          await browser.electron.execute(() => {
            const innerFunc = () => 'executed inner function';
            return innerFunc();
          }),
        ).toEqual('executed inner function');
      });
    });
  });
});

describe('browser.execute - workaround for TSX issue', () => {
  // Tests for the following issue - can be removed when the TSX issue is resolved
  // https://github.com/webdriverio-community/wdio-electron-service/issues/756
  // https://github.com/privatenumber/tsx/issues/113

  it('should handle executing a function which declares a function', async () => {
    expect(
      await browser.execute(() => {
        function innerFunc() {
          return 'executed inner function';
        }
        return innerFunc();
      }),
    ).toEqual('executed inner function');
  });

  it('should handle executing a function which declares an arrow function', async () => {
    expect(
      await browser.execute(() => {
        const innerFunc = () => 'executed inner function';
        return innerFunc();
      }),
    ).toEqual('executed inner function');
  });
});
