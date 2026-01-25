import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  build: {
    lib: {
      entry: `src/index.ts`,
      name: `TDSKShell`,
      formats: [`es`],
      fileName: (format) => `shell.js`,
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
      include: [`buffer`, `process`, `util`, `stream`, `events`, `os`, `path`],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
} as UserConfig)
