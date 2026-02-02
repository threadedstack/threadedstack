import { runWasm } from '@tdsk/wasm'
import { join } from 'node:path'
import { runbash } from '@TSH/dist/wasm/bash.run.js'

//const r1 = await runWasm({
//  modulePath: join(process.cwd(), 'dist/wasm/bash.js'),
//})
//
//console.log('--- runWasm OUTPUT START ---')
//console.log(r1)
//console.log('--- runWasm OUTPUT END ---')

const { runBash } = await runbash()

const r2 = await runBash()

console.log('--- runBash OUTPUT START ---')
console.log(r2)
console.log('--- runBash OUTPUT END ---')
