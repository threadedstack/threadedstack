import { env } from './env'
import type { SSEEvent } from './sse'

/**
 * Consume an SSE stream from /ai/chat using session-token auth.
 *
 * Unlike the regular SSE helper, this:
 * - Uses `Authorization: Session <token>` (not Bearer API key)
 * - Hits /ai/chat directly (no /_ prefix)
 */
export const consumeSessionSSE = async (
  sessionToken: string,
  body: { messages: unknown[]; tools?: unknown[] },
  opts?: { timeout?: number }
): Promise<{ events: SSEEvent[]; raw: string }> => {
  const url = `${env.proxyUrl}/ai/chat`
  const timeout = opts?.timeout ?? 30_000

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Session ${sessionToken}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })

  const events: SSEEvent[] = []
  let raw = ''

  if (!res.body) {
    return { events, raw }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    raw += chunk
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return { events, raw }

      try {
        events.push(JSON.parse(payload) as SSEEvent)
      } catch {
        // Non-JSON SSE line, skip
      }
    }
  }

  return { events, raw }
}
