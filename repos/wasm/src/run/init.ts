import type { TWasmRunOpts } from '@TWA/types'

import { join, dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation'

// Types (Adjusted based on your previous code)
interface InitOpts {
  args?: string[]
  logging?: boolean
  network?: boolean
  modulePath: string
  env?: Record<string, string>
  imports?: Record<string, any>
  preopens?: Record<string, string>
}

interface InitResp {
  exports: any
  imports: any
  [K: string]: (...args: any) => any
}

export const init = async (options: InitOpts): Promise<InitResp> => {
  const {
    env = {},
    args = [],
    modulePath,
    preopens = {},
    network = true,
    logging = false,
    imports: customImports = {},
  } = options

  // Step 1: Dynamic import of the WASM module
  const wasmModule = await import(modulePath)

  // The module should export an `instantiate` function
  if (!isFunc(wasmModule.instantiate))
    throw new Error(`WASM module missing instantiate function. Built with jco?`)

  const log = (...msg: unknown[]) => logging && console.log(...msg)

  const moduleDir = dirname(modulePath)

  // 2. Configure the WASI Shim
  const shim = new WASIShim({
    sandbox: {
      enableNetwork: true,
      args: [...process.argv],
      env: { ...process.env } as Record<string, string>,
      preopens: {
        [`.`]: `/tmp/tdsk`,
      },
    },
  })
  //const shim = new WASIShim({
  //  sandbox: {
  //    env,
  //    args,
  //    preopens,
  //    enableNetwork: network,
  //  }
  //})

  // 3. Generate the Import Object
  const standardImports = shim.getImportObject()

  // 4. Merge with User Overrides
  // Custom imports take precedence over the shim's defaults
  const mergedImports = {
    ...standardImports,
    ...customImports,
  }

  log(`Instantiating WASM with imports:`, Object.keys(mergedImports))

  // 5. Define Core Module Loader
  // Required for jco to load the underlying .wasm file(s) in Node.js
  const getCoreModule = async (url: string): Promise<WebAssembly.Module> => {
    const fileName = url.split('/').pop()
    const filePath = join(moduleDir, fileName!)

    try {
      const bytes = (await readFile(filePath)) as BufferSource
      return WebAssembly.compile(bytes)
    } catch (error) {
      throw new Error(`Failed to compile WASM file at ${filePath}: ${error}`)
    }
  }

  // 6. Instantiate
  return await wasmModule.instantiate(getCoreModule, mergedImports)
}
