import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const projectKey = createHash('sha256').update(projectRoot).digest('hex').slice(0, 16);
const cacheDirectory = join(process.env.LOCALAPPDATA ?? tmpdir(), 'Forma', 'vite-cache', projectKey);

export default defineConfig({
  root: projectRoot,
  plugins: [react({ exclude: [/node_modules/, `${normalizePath(cacheDirectory)}/**`] })],
  // Keep generated dependency caches out of synced folders and isolate them per project.
  cacheDir: cacheDirectory,
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
