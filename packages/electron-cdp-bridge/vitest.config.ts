import { configDefaults, defineConfig } from 'vitest/config';

const runE2E = Boolean(process.env.RUN_E2E);

const include = runE2E ? ['e2e/**/*.spec.ts'] : ['test/**/*.spec.ts'];
const testTimeout = runE2E ? 15000 : 5000;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include,
    exclude: [...configDefaults.exclude, 'example*/**/*'],
    clearMocks: true,
    testTimeout,
    silent: runE2E,
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*'],
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
