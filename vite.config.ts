import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any subpath (e.g. GitHub Pages).
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', sprites: 'sprites.html' },
    },
  },
});
