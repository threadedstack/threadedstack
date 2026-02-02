import { runWasm } from '@tdsk/wasm'
import { join } from 'node:path'

const result = await runWasm({
  modulePath: join(process.cwd(), 'dist/wasm/bash.js'),
})

console.log('--- WASM OUTPUT START ---')
console.log(result)
console.log('--- WASM OUTPUT END ---')
