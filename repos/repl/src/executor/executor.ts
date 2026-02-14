import type { TStreamEvent } from '@tdsk/domain'
import type { ApiClient, TSessionInfo } from '@TRL/api'

import { AgentRunner, ProxyAdapter } from '@tdsk/agent'
import { HttpMessageAdapter } from './httpAdapter'

export type TRunResult = {
  threadId: string
}

/**
 * Runs the agent loop locally while proxying LLM calls through the backend.
 *
 * 1. Creates a session (backend resolves API key, returns session token)
 * 2. Creates/reuses a thread via backend
 * 3. Runs AgentRunner locally with ProxyAdapter (LLM calls go through backend SSE)
 */
export class LocalAgentExecutor {
  #client: ApiClient

  constructor(client: ApiClient) {
    this.#client = client
  }

  get client(): ApiClient {
    return this.#client
  }

  async createSession(agentId: string): Promise<TSessionInfo> {
    return this.#client.createSession(agentId)
  }

  async run(opts: {
    orgId: string
    agentId: string
    prompt: string
    userId: string
    threadId?: string
    onEvent: (event: TStreamEvent) => void
  }): Promise<TRunResult> {
    const { orgId, agentId, prompt, userId, onEvent } = opts

    // 1. Create session (backend resolves API key, returns session token)
    const session = await this.createSession(agentId)

    // 2. Create ProxyAdapter — LLM calls go through backend SSE proxy
    const adapter = new ProxyAdapter({
      backendUrl: this.#client.proxyUrl,
      sessionToken: session.sessionToken,
      provider: session.provider,
    })

    // 3. Create or reuse thread
    let threadId = opts.threadId
    if (!threadId) {
      const thread = (await this.#client.createThread(orgId, agentId)) as { id: string }
      threadId = thread.id
    }

    // 4. Create HTTP message adapter
    const db = new HttpMessageAdapter(this.#client, orgId, agentId)

    // 5. Run agent locally with ProxyAdapter
    await AgentRunner.run({
      db,
      orgId,
      prompt,
      userId,
      adapter,
      onEvent,
      agentId,
      threadId,
      maxSteps: 10,
      llmConfig: {
        model: session.model,
        provider: session.provider,
        maxTokens: session.maxTokens,
        systemPrompt: session.systemPrompt,
      },
    })

    return { threadId }
  }
}
