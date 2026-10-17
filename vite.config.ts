import { defineConfig } from 'vite';

// Build statique hébergeable n'importe où (GitHub Pages, itch.io, serveur local) :
// chemins relatifs, sortie dans docs/ pour pouvoir publier le dossier tel quel.
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
  server: { host: true },
});
