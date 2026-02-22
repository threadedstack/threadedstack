/**
 * Vitest setupFile — runs in each worker thread before test files.
 * Suppresses the NODE_TLS_REJECT_UNAUTHORIZED warning and enables
 * TLS bypass for integration tests against Caddy's local CA.
 */
const { emitWarning } = process
process.emitWarning = (warning: string | Error, ...args: any) => {
  const m = typeof warning === `string` ? warning : warning.message
  if (m.includes(`NODE_TLS_REJECT_UNAUTHORIZED`)) {
    process.emitWarning = emitWarning
    return
  }
  return emitWarning(warning, ...args)
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`
