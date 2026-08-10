import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration complying with SOP #4 (Build & Deployment)
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
