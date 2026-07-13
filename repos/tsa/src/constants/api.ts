export const RefreshBufferMs = 2 * 60 * 1000
// Bounds the token-refresh fetch to Neon Auth -- without it, a hung/black-holed
// auth host never settles this call, and since #tryRefresh caches the in-flight
// promise, every subsequent API call blocks on the same hung refresh, freezing
// the whole CLI (matches ProxyRequestTimeoutMs / RequestTimeoutMS conventions
// used for other external-call timeouts elsewhere in the codebase).
export const TokenRefreshTimeoutMs = 30 * 1000
// Bounds the first-login validation fetch to the proxy -- without it, a
// black-holed/unreachable proxy never settles this call, hanging `tsa login`
// indefinitely with no error and no way to know it's stuck short of Ctrl-C.
export const LoginRequestTimeoutMs = 10 * 1000
export const RetryStatusCodes = new Set([429, 500, 502, 503])
export const RetryNetworkCodes = new Set([`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`])

export const CliAuthPath = `/auth/cli`
export const LocalUrlPath = `local.threadedstack.app`

const LocalThreadsUrl = `http://localhost:5886`
const ProdThreadsUrl = `https://threads.threadedstack.com`
const DevThreadsUrl = `https://threads.dev.threadedstack.com`

const LocalProxyUrl = `https://px.${LocalUrlPath}`
const ProdProxyUrl = `https://px.threadedstack.app`
const DevProxyUrl = `https://px.dev.threadedstack.app`

export const EnvUrlMap = {
  develop: { proxy: DevProxyUrl, threads: DevThreadsUrl },
  local: { proxy: LocalProxyUrl, threads: LocalThreadsUrl },
  production: { proxy: ProdProxyUrl, threads: ProdThreadsUrl },
} as const
