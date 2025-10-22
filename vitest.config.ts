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
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
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
