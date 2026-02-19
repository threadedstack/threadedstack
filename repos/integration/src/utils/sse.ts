import { env } from './env'

export interface SSEEvent {
  type?: string
  [key: string]: unknown
}

/**
 * Parse an SSE stream from an agent/run endpoint.
 * Collects events until `[DONE]` marker.
 *
 * Requests go through the proxy with API key auth.
 */
export const consumeSSE = async (
  path: string,
  body: unknown,
  opts?: { apiKey?: string }
): Promise<{ events: SSEEvent[]; threadId: string | null }> => {
  const fullPath = path.startsWith('/_') || path.startsWith('/health')
    ? path
    : `/_${path.startsWith('/') ? '' : '/'}${path}`

  const url = `${env.proxyUrl}${fullPath}`

  const key = opts?.apiKey ?? env.testApiKey
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(key ? { 'Authorization': `Bearer ${key}` } : {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  })

  const threadId = res.headers.get('X-Thread-Id')
  const events: SSEEvent[] = []

  if (!res.body) {
    return { events, threadId }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return { events, threadId }

        try {
          events.push(JSON.parse(payload) as SSEEvent)
        } catch {
          // Non-JSON SSE line, skip
        }
      }
    }
  } catch {
    // Timeout or abort — return events collected so far
  }

  return { events, threadId }
}
