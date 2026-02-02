/**
 * Reexport globalThis.process
 * Gets injected into the global-scope via the esbuild banner, So it should always exist
 * This gets as the polyfill for `node:process` imports so process is not defined twice in build
 */
export const process = globalThis.process
export default process
