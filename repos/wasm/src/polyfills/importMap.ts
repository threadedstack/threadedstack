/**
 * Polyfill Registry System for @tdsk/wasm
 *
 * Manages internal and custom polyfills for WASM builds.
 * Supports flexible registration with all, include, exclude, and custom options.
 */

import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const vendor = join(__dirname, `vendor`)

/**
 * Map of module names to their polyfill file paths
 * Supports both `node:` prefixed and non-prefixed module names
 *
 * After bundling, __dirname points to the dist/ folder of the installed package.
 * The polyfills are copied to dist/polyfills/ during the build.
 *
 */
export const ImportMap: Record<string, string> = {
  [`assert`]: join(vendor, `assert.js`),
  [`node:assert`]: join(vendor, `assert.js`),

  [`buffer`]: join(vendor, `buffer.js`),
  [`node:buffer`]: join(vendor, `buffer.js`),

  [`crypto`]: join(vendor, `crypto.js`),
  [`node:crypto`]: join(vendor, `crypto.js`),

  [`encoding`]: join(vendor, `encoding.js`),
  [`node:encoding`]: join(vendor, `encoding.js`),

  [`events`]: join(vendor, `events.js`),
  [`node:events`]: join(vendor, `events.js`),

  [`global`]: join(vendor, `global.js`),

  [`os`]: join(vendor, `os.js`),
  [`node:os`]: join(vendor, `os.js`),

  [`path`]: join(vendor, `path.js`),
  [`node:path`]: join(vendor, `path.js`),

  [`process`]: join(vendor, `proc.js`),
  [`node:process`]: join(vendor, `proc.js`),

  [`punycode`]: join(vendor, `punycode.js`),
  [`node:punycode`]: join(vendor, `punycode.js`),

  [`querystring`]: join(vendor, `querystring.js`),
  [`node:querystring`]: join(vendor, `querystring.js`),

  [`stream/promises`]: join(vendor, `stream/promises.js`),
  [`node:stream/promises`]: join(vendor, `stream/promises.js`),

  [`stream`]: join(vendor, `stream.js`),
  [`node:stream`]: join(vendor, `stream.js`),

  [`string_decoder`]: join(vendor, `string_decoder.js`),
  [`node:string_decoder`]: join(vendor, `string_decoder.js`),

  [`timers`]: join(vendor, `timers.js`),
  [`node:timers`]: join(vendor, `timers.js`),

  [`vm`]: join(vendor, `vm.js`),
  [`node:vm`]: join(vendor, `vm.js`),

  [`zlib`]: join(vendor, `zlib.js`),
  [`node:zlib`]: join(vendor, `zlib.js`),
}
