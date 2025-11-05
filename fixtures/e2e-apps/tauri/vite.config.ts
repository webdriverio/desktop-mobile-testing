import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
  // Ensure workspace packages are resolved correctly
  resolve: {
    preserveSymlinks: false,
  },
});
