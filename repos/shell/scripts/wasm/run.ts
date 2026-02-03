import { join } from 'node:path'
import { init } from '@tdsk/wasm'

//import { runWasm } from '@tdsk/wasm'
//import { runbash } from '@TSH/dist/wasm/bash.run.js'

//const r1 = await runWasm({
//  modulePath: join(process.cwd(), 'dist/wasm/bash.js'),
//})

const { run } = await init({
  modulePath: join(process.cwd(), 'dist/wasm/shell.js'),
})

//console.log('--- runWasm OUTPUT START ---')
//console.log(r1)
//console.log('--- runWasm OUTPUT END ---')

//const { runBash } = await runbash()
//
//
const r2 = await run(`ls -la`)
console.log(r2)

//console.log(`------- resp -------`)
//console.log(resp)
