// @ts-nocheck

import hq from 'alias-hq'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { instantiate } from '@TSH/dist/wasm/bash'
import * as shim from '@bytecodealliance/preview2-shim'

const aliases = hq.get(`webpack`)
const rootDir = aliases[`@TSH/root`]
const distDir = aliases[`@TSH/dist`]

async function main() {
  const component = await instantiate(
    async (url) => {
      const fileName = url.split(`/`).pop()
      const filePath = join(distDir, `wasm/`, fileName!)
      const bytes = (await readFile(filePath)) as BufferSource
      return WebAssembly.compile(bytes)
    },
    {
      // 2. Explicitly wire the CLI (The fix for your error)
      'wasi:cli/stdin': shim.cli.stdin,
      'wasi:cli/stdout': shim.cli.stdout,
      'wasi:cli/stderr': shim.cli.stderr,
      'wasi:cli/terminal-input': shim.cli.terminalInput,
      'wasi:cli/terminal-output': shim.cli.terminalOutput,
      'wasi:cli/terminal-stderr': shim.cli.terminalStderr,
      'wasi:cli/terminal-stdin': shim.cli.terminalStdin,
      'wasi:cli/terminal-stdout': shim.cli.terminalStdout,
      // 6. Explicitly wire Environment (Exit codes, args, env vars)
      'wasi:cli/environment': shim.cli.environment,
      'wasi:cli/exit': shim.cli.exit,

      // 'wasi:http/types': shim.http.types,
      'wasi:http/outgoing-handler': shim.http.outgoingHandler,
      'wasi:http/types': shim.http.types,

      // 3. Explicitly wire Clocks & IO (Often required by JCO components)
      'wasi:clocks/monotonic-clock': shim.clocks.monotonicClock,
      'wasi:clocks/wall-clock': shim.clocks.wallClock,
      'wasi:io/streams': shim.io.streams,
      'wasi:io/error': shim.io.error,
      'wasi:io/poll': shim.io.poll,

      // 4. Explicitly wire Filesystem (Required if bash tries to read files)
      'wasi:filesystem/types': shim.filesystem.types,
      'wasi:filesystem/preopens': shim.filesystem.preopens,

      // 5. Explicitly wire Random (We patched Math.random, but the interface might still be imported)
      'wasi:random/random': shim.random.random,
    }
  )

  console.log('--- WASM OUTPUT START ---')
  const result = await component.runBash()
  console.log('--- WASM OUTPUT END ---')
  console.log(result)
}

main()
