import { env } from './env'

/**
 * Check that a service is reachable at its health endpoint.
 * Throws with actionable instructions if unreachable.
 */
const checkService = async (name: string, url: string): Promise<void> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) {
      throw new Error(`${name} returned ${res.status} at ${url}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `${name} health check failed: ${msg}\n` +
        `  URL: ${url}\n` +
        `  Hint: Run "tdsk dev start --clean" to start K8s services`
    )
  }
}

/**
 * Pre-flight check: ensure proxy (and backend behind it) is reachable.
 * The proxy health endpoint is public — no auth required.
 */
export const checkHealth = async (): Promise<void> => {
  await checkService('Proxy', `${env.proxyUrl}/health`)
}
