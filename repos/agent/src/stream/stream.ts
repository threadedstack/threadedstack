import type { TProxyConfig } from '@TAG/types'
import type { AssistantMessage, AssistantMessageEvent } from '@mariozechner/pi-ai'
import type { StreamFn, ProxyAssistantMessageEvent } from '@mariozechner/pi-agent-core'

import { createAssistantMessageEventStream } from '@mariozechner/pi-ai'

/**
 * Creates a pi-mono StreamFn that routes LLM calls through the ThreadedStack
 * backend's /ai/stream SSE proxy endpoint.
 *
 * Uses ThreadedStack's session token auth (`Authorization: Session <token>`)
 * and the `/_/ai/stream` endpoint convention. The backend:
 *  1. Validates the session token
 *  2. Uses `streamSimple` from pi-ai to call the LLM
 *  3. Converts events to ProxyAssistantMessageEvent (stripped partial) for bandwidth
 *  4. Streams them back as SSE
 */
export const createStreamProxy = (config: TProxyConfig): StreamFn => {
  return (model, context, options) => {
    const stream = createAssistantMessageEventStream()

    // Build the partial message we'll reconstruct from proxy events
    const partial: AssistantMessage = {
      content: [],
      api: model.api,
      model: model.id,
      role: `assistant`,
      stopReason: `stop`,
      timestamp: Date.now(),
      provider: model.provider,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    }

    ;(async () => {
      try {
        const response = await fetch(`${config.backendUrl}/ai/stream`, {
          method: `POST`,
          headers: {
            'Content-Type': `application/json`,
            Authorization: `Session ${config.sessionToken}`,
          },
          body: JSON.stringify({
            model,
            context,
            options: {
              temperature: options?.temperature,
              maxTokens: options?.maxTokens,
              reasoning: (options as any)?.reasoning,
            },
          }),
          signal: options?.signal,
        })

        if (!response.ok) {
          throw new Error(`LLM proxy error (${response.status})`)
        }

        if (!response.body) {
          throw new Error(`No response body from LLM proxy`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ``

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (options?.signal?.aborted) throw new Error(`Request aborted`)

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(`\n`)
          buffer = lines.pop() || ``

          for (const line of lines) {
            if (!line.startsWith(`data: `)) continue
            const data = line.slice(6).trim()
            if (!data || data === `[DONE]`) continue

            const proxyEvent = JSON.parse(data) as ProxyAssistantMessageEvent
            const event = processProxyEvent(proxyEvent, partial)
            if (event) stream.push(event)
          }
        }

        stream.end()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        const reason = options?.signal?.aborted ? `aborted` : `error`
        partial.stopReason = reason as any
        partial.errorMessage = errorMessage
        stream.push({
          type: `error`,
          reason: reason as any,
          error: partial,
        })
        stream.end()
      }
    })()

    return stream
  }
}

/**
 * Process a ProxyAssistantMessageEvent and update the partial message.
 * Mirrors pi-mono's processProxyEvent but inlined here for independence.
 */
const processProxyEvent = (
  event: ProxyAssistantMessageEvent,
  partial: AssistantMessage
): AssistantMessageEvent | undefined => {
  switch (event.type) {
    case `start`:
      return { type: `start`, partial }

    case `text_start`:
      partial.content[event.contentIndex] = { type: `text`, text: `` }
      return { type: `text_start`, contentIndex: event.contentIndex, partial }

    case `text_delta`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `text`) {
        c.text += event.delta
        return {
          type: `text_delta`,
          contentIndex: event.contentIndex,
          delta: event.delta,
          partial,
        }
      }
      return undefined
    }

    case `text_end`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `text`) {
        return {
          type: `text_end`,
          contentIndex: event.contentIndex,
          content: c.text,
          partial,
        }
      }
      return undefined
    }

    case `thinking_start`:
      partial.content[event.contentIndex] = { type: `thinking`, thinking: `` }
      return { type: `thinking_start`, contentIndex: event.contentIndex, partial }

    case `thinking_delta`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `thinking`) {
        c.thinking += event.delta
        return {
          type: `thinking_delta`,
          contentIndex: event.contentIndex,
          delta: event.delta,
          partial,
        }
      }
      return undefined
    }

    case `thinking_end`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `thinking`) {
        return {
          type: `thinking_end`,
          contentIndex: event.contentIndex,
          content: c.thinking,
          partial,
        }
      }
      return undefined
    }

    case `toolcall_start`:
      partial.content[event.contentIndex] = {
        type: `toolCall`,
        id: event.id,
        name: event.toolName,
        arguments: {},
      }
      return { type: `toolcall_start`, contentIndex: event.contentIndex, partial }

    case `toolcall_delta`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `toolCall`) {
        return {
          type: `toolcall_delta`,
          contentIndex: event.contentIndex,
          delta: event.delta,
          partial,
        }
      }
      return undefined
    }

    case `toolcall_end`: {
      const c = partial.content[event.contentIndex]
      if (c?.type === `toolCall`) {
        return {
          type: `toolcall_end`,
          contentIndex: event.contentIndex,
          toolCall: c,
          partial,
        }
      }
      return undefined
    }

    case `done`:
      partial.usage = event.usage
      partial.stopReason = event.reason
      return { type: `done`, reason: event.reason, message: partial }

    case `error`:
      partial.usage = event.usage
      partial.stopReason = event.reason
      partial.errorMessage = event.errorMessage
      return { type: `error`, reason: event.reason, error: partial }

    default:
      return undefined
  }
}
