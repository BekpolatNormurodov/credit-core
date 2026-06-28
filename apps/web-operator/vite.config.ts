import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const repoRoot = resolve(__dirname, '..', '..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Use TS source for shared so the frontend doesn't need a prebuild step.
      '@credit-core/shared': resolve(repoRoot, 'packages/shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
  },
});
