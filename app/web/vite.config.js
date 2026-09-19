import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const designDir = fileURLToPath(new URL('../../design', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@design': designDir } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
    fs: { allow: [repoRoot] },
  },
});
