import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any subpath (e.g. GitHub Pages).
  base: './',
  build: {
    // All target browsers support modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { main: 'index.html', sprites: 'sprites.html' },
    },
  },
});
