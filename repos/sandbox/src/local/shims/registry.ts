import { osShim } from './os'
import { fsShim } from './fs'
import { urlShim } from './url'
import { utilShim } from './util'
import { pathShim } from './path'
import { fetchShim } from './fetch'
import { bufferShim } from './buffer'
import { eventsShim } from './events'
import { assertShim } from './assert'
import { cryptoShim } from './crypto'
import { consoleShim } from './console'
import { processShim } from './process'
import { querystringShim } from './querystring'
import { childProcessShim } from './childProcess'

/**
 * Ordered array of all builtin shim definitions.
 * ORDER IS SIGNIFICANT: shims are compiled in array order.
 * Console and fetch must come first (globals-only, set up _log and _fetch callbacks).
 * Shims that set globalThis values (e.g. buffer sets globalThis.Buffer)
 * must appear before shims that use those globals (e.g. crypto uses Buffer).
 * Do not reorder without verifying dependency chains.
 */
export const shimRegistry = [
  consoleShim,
  fetchShim,
  bufferShim,
  pathShim,
  fsShim,
  childProcessShim,
  urlShim,
  querystringShim,
  eventsShim,
  osShim,
  assertShim,
  utilShim,
  cryptoShim,
  processShim,
]

/**
 * Flat list of all module names that the builtin shims register,
 * used to distinguish user modules from builtins during cleanup.
 */
export const builtinShimNames = new Set(shimRegistry.flatMap((s) => s.names))
