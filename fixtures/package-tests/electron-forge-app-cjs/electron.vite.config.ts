import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      },
    },
  },
  preload: {
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        output: {
          format: 'cjs',
        },
      },
    },
    // workaround for windows path issue
    // see https://github.com/alex8088/electron-vite/issues/802
    resolve: {
      preserveSymlinks: true,
    },
  },
});
