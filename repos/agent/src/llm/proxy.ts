import type {
  TAIMessage,
  TStreamEvent,
  TLLMToolDef,
  TLLMAdapterConfig,
  TLLMProviderType,
  ILLMAdapter,
} from '@tdsk/domain'

/**
 * ProxyAdapter - Routes LLM calls through the backend SSE proxy
 *
 * Instead of calling the LLM provider directly (which requires the API key),
 * this adapter POSTs to the backend's /ai/chat endpoint using a session token.
 * The backend looks up the cached session, injects the API key, and streams
 * the response back via SSE.
 */
export class ProxyAdapter implements ILLMAdapter {
  readonly provider: TLLMProviderType

  #backendUrl: string
  #sessionToken: string

  constructor(opts: {
    backendUrl: string
    sessionToken: string
    provider: TLLMProviderType
  }) {
    this.provider = opts.provider
    this.#backendUrl = opts.backendUrl
    this.#sessionToken = opts.sessionToken
  }

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    _config: TLLMAdapterConfig
  ): AsyncGenerator<TStreamEvent> {
    const res = await fetch(`${this.#backendUrl}/ai/chat`, {
      method: `POST`,
      headers: {
        [`Content-Type`]: `application/json`,
        Authorization: `Session ${this.#sessionToken}`,
      },
      body: JSON.stringify({ messages, tools }),
    })

    if (!res.ok) {
      throw new Error(`LLM proxy error (${res.status})`)
    }

    if (!res.body) {
      throw new Error(`No response body from LLM proxy`)
    }

    let buffer = ``
    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(`\n`)
      buffer = lines.pop() || ``

      for (const line of lines) {
        if (!line.startsWith(`data: `)) continue
        const data = line.slice(6).trim()
        if (data === `[DONE]`) return
        yield JSON.parse(data) as TStreamEvent
      }
    }
  }
}
