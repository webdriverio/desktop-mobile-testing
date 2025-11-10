import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'es',
        },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['electron'],
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    build: {
      rollupOptions: {
        output: {
          format: 'es',
        },
      },
    },
    resolve: {
      // workaround for windows path issue
      // see https://github.com/alex8088/electron-vite/issues/802
      preserveSymlinks: true,
    },
  },
});
