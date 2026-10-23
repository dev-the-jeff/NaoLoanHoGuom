import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)), base: './',
  server: { host: '0.0.0.0', port: Number(process.env.CLIENT_PORT || 5173), strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true },
});


