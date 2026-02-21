import type { TStreamEvent } from '@tdsk/domain'
import type { ApiClient, TSessionInfo } from '@TRL/api'
import type { TContextFile } from '@TRL/types'

import { AgentRunner } from '@tdsk/agent'
import { DefaultMaxSteps } from '@TRL/constants'
import { HttpMessageAdapter } from './httpAdapter'

export type TRunResult = {
  threadId: string
}

/**
 * Runs the agent loop locally while proxying LLM calls through the backend.
 *
 * 1. Creates a session (backend resolves API key, returns session token)
 * 2. Creates/reuses a thread via backend
 * 3. Runs AgentRunner locally with proxyConfig (LLM calls go through backend SSE)
 */
export class LocalAgentExecutor {
  #client: ApiClient
  #cachedSession: { session: TSessionInfo; agentId: string; providerId?: string } | null =
    null

  constructor(client: ApiClient) {
    this.#client = client
  }

  get client(): ApiClient {
    return this.#client
  }

  async createSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    return this.#client.createSession(agentId, providerId)
  }

  async #getOrCreateSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    if (
      this.#cachedSession &&
      this.#cachedSession.agentId === agentId &&
      this.#cachedSession.providerId === providerId
    ) {
      return this.#cachedSession.session
    }
    const session = await this.createSession(agentId, providerId)
    this.#cachedSession = { session, agentId, providerId }
    return session
  }

  clearSessionCache(): void {
    this.#cachedSession = null
  }

  async run(opts: {
    orgId: string
    agentId: string
    prompt: string
    userId: string
    threadId?: string
    providerId?: string
    maxSteps?: number
    contextFiles?: TContextFile[]
    onEvent: (event: TStreamEvent) => void
  }): Promise<TRunResult> {
    const { orgId, agentId, prompt, userId, onEvent } = opts

    // 1. Get or reuse session (backend resolves API key, returns session token)
    const session = await this.#getOrCreateSession(agentId, opts.providerId)

    // 2. Create or reuse thread
    let threadId = opts.threadId
    if (!threadId) {
      const thread = await this.#client.createThread(orgId, agentId)
      threadId = thread.id
    }

    // 3. Build final prompt with optional context files
    let finalPrompt = prompt
    if (opts.contextFiles?.length) {
      const contextBlock = opts.contextFiles
        .map((f) => `--- ${f.name} ---\n${f.content}`)
        .join('\n\n')
      finalPrompt = `<context>\n${contextBlock}\n</context>\n\n${prompt}`
    }

    // 4. Create HTTP message adapter
    const db = new HttpMessageAdapter(this.#client, orgId, agentId)

    // 5. Run agent locally — LLM calls go through backend SSE
    await AgentRunner.run({
      db,
      orgId,
      userId,
      onEvent,
      agentId,
      threadId,
      prompt: finalPrompt,
      maxSteps: opts.maxSteps || DefaultMaxSteps,
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
