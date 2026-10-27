import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any subpath (e.g. GitHub Pages).
  base: './',
  build: {
    // All target browsers support modulepreload natively.
    modulePreload: { polyfill: false },
    rollupOptions: {
      // The compendium is built to wiki/index.html, so Pages serves it at <site>/wiki/.
      input: { main: 'index.html', sprites: 'sprites.html', wiki: 'wiki/index.html' },
    },
  },
});
