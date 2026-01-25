import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  build: {
    lib: {
      entry: `src/index.ts`,
      name: `TDSKShell`,
      formats: [`es`, `umd`],
      fileName: (format) => `shell.${format}.js`,
    },
    target: `esnext`,
    sourcemap: true,
    rollupOptions: {
      external: [],
    },
  },
  worker: {
    format: `es`,
    plugins: () => [nodePolyfills()],
  },
  optimizeDeps: {
    exclude: [`@tdsk/shell`],
  },
  plugins: [
    nodePolyfills({
      include: [`buffer`, `process`, `util`, `stream`, `events`],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: {
    headers: {
      [`Cross-Origin-Opener-Policy`]: `same-origin`,
      [`Cross-Origin-Embedder-Policy`]: `require-corp`,
    },
  },
  preview: {
    headers: {
      [`Cross-Origin-Opener-Policy`]: `same-origin`,
      [`Cross-Origin-Embedder-Policy`]: `require-corp`,
    },
  },
} as UserConfig)
