export const RefreshBufferMs = 2 * 60 * 1000
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
