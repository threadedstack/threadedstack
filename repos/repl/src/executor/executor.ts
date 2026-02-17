import type { TStreamEvent } from '@tdsk/domain'
import type { ApiClient, TSessionInfo } from '@TRL/api'

import { PiAgentRunner } from '@tdsk/agent'
import { HttpMessageAdapter } from './httpAdapter'

export type TRunResult = {
  threadId: string
}

/**
 * Runs the agent loop locally while proxying LLM calls through the backend.
 *
 * 1. Creates a session (backend resolves API key, returns session token)
 * 2. Creates/reuses a thread via backend
 * 3. Runs PiAgentRunner locally with proxyConfig (LLM calls go through backend SSE)
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

    // 2. Create or reuse thread
    let threadId = opts.threadId
    if (!threadId) {
      const thread = await this.#client.createThread(orgId, agentId)
      threadId = thread.id
    }

    // 3. Create HTTP message adapter
    const db = new HttpMessageAdapter(this.#client, orgId, agentId)

    // 4. Run agent locally — LLM calls go through backend SSE
    await PiAgentRunner.run({
      db,
      orgId,
      prompt,
      userId,
      onEvent,
      agentId,
      threadId,
      maxSteps: 10,
      proxyConfig: {
        backendUrl: this.#client.proxyUrl,
        sessionToken: session.sessionToken,
      },
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
