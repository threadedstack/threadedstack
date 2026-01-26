import './shims'
import { Buffer } from 'buffer'
import process from 'process'

// @ts-ignore
globalThis.Buffer = Buffer;
// @ts-ignore
globalThis.process = process;


globalThis.env = globalThis.env || {}
globalThis.argv = globalThis.argv || []