import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const injectBanner = async () => {
  const content = await readFile(join(__dirname, `process.ts`), { encoding: `utf8` })

  return `
    Math.random = (function() {
      let seed = 0x12345678
      return function() {
          // Simple LCG (Linear Congruential Generator)
          seed = (seed * 1664525 + 1013904223) >>> 0
          return seed / 4294967296
      }
    })()
    ${content}
  `
}
