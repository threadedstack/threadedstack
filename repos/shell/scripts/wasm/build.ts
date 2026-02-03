import { buildWasm } from '@tdsk/wasm'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
await buildWasm({
  name: `shell`,
  root: join(__dirname, `../..`),
  polyfills: {
    all: true,
  },
})
