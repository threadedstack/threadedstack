import './shims'
import './imports'
import process from 'process'
import { Buffer } from 'buffer'
import { TextEncoder, TextDecoder } from 'encoding'

/**
 * Figure out how to dynamically set these when the app is initialized
 * May need to add proxies to make it work
 * Looks something like this:
 * @example
 * ```
 * import { getEnvironment } from 'wasi:cli/environment@0.2.0'
 * const data = getEnvironment()
 * for (const [k, v] of data)
 *   globalThis.env[k] = v
 * ```
 *
 */
globalThis.env = globalThis.env || {}
globalThis.argv = globalThis.argv || []

// Set the default Node.JS globals if they don't exist
globalThis.TextDecoder = TextDecoder
globalThis.TextEncoder = TextEncoder
globalThis.Buffer = globalThis.Buffer || Buffer
globalThis.process = globalThis.process || process
globalThis.global = globalThis.global || globalThis

//clearImmediate: [Function: clearImmediate],
//setImmediate: [Function: setImmediate] {
//  [Symbol(nodejs.util.promisify.custom)]: [Getter]
//},
//clearInterval: [Function: clearInterval],
//clearTimeout: [Function: clearTimeout],
//setInterval: [Function: setInterval],
//setTimeout: [Function: setTimeout] {
//  [Symbol(nodejs.util.promisify.custom)]: [Getter]
//},
//queueMicrotask: [Function: queueMicrotask],
//structuredClone: [Function: structuredClone],
//atob: [Getter/Setter],
//btoa: [Getter/Setter],
//performance: [Getter/Setter],
//fetch: [Function: fetch],
//crypto: [Getter]
