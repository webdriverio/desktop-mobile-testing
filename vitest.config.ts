import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration for all packages in the monorepo
 * Individual packages can extend this configuration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/.turbo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 75,
        statements: 75,
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/test/**',
        '**/*.{test,spec}.{js,ts}',
        '**/types/**',
        '**/*.d.ts',
      ],
    },
  },
});
