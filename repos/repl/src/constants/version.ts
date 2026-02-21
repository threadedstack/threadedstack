/**
 * Package version — injected at build time via Bun's `define` option.
 * When running from source (bun run src/index.ts), the global is undefined
 * and we fall back to reading package.json dynamically.
 */
const resolveVersion = (): string => {
  try {
    // @ts-expect-error Injected by build script via `define`
    return __TDSK_REPL_VERSION__
  } catch {
    // Running from source — resolve package.json dynamically
    try {
      const { createRequire } = require('node:module')
      const req = createRequire(import.meta.url)
      return req('../../package.json').version
    } catch {
      return `0.0.0`
    }
  }
}

export const Version = resolveVersion()
