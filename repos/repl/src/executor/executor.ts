import type { TStreamEvent, TLLMAdapterConfig } from '@tdsk/domain'
import type { ApiClient } from '@TRL/api'

import { AgentRunner } from '@tdsk/agent'
import { HttpMessageAdapter } from './httpAdapter'

type TResolvedAgentConfig = {
  agentId: string
  orgId: string
  llmConfig: TLLMAdapterConfig
  sandboxConfig?: {
    provider: string
    apiKey?: string
    template?: string
    timeout?: number
    envVars?: Record<string, string>
  }
  tools?: string[]
  environment?: Record<string, unknown>
}

export type TRunResult = {
  threadId: string
}

/**
 * Runs the agent loop locally while persisting messages via the backend API.
 *
 * 1. Resolves agent config (decrypted LLM key) from backend
 * 2. Creates/reuses a thread via backend
 * 3. Runs AgentRunner locally with HTTP message adapter
 */
export class LocalAgentExecutor {
  #client: ApiClient

  constructor(client: ApiClient) {
    this.#client = client
  }

  get client(): ApiClient {
    return this.#client
  }

  async resolve(orgId: string, agentId: string): Promise<TResolvedAgentConfig> {
    return (await this.#client.resolveAgent(orgId, agentId)) as TResolvedAgentConfig
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

    // 1. Resolve agent config (decrypted LLM key) from backend
    const config = await this.resolve(orgId, agentId)

    // 2. Create or reuse thread
    let threadId = opts.threadId
    if (!threadId) {
      const thread = (await this.#client.createThread(orgId, agentId)) as { id: string }
      threadId = thread.id
    }

    // 3. Create HTTP message adapter
    const db = new HttpMessageAdapter(this.#client, orgId, agentId)

    // 4. Run agent locally
    await AgentRunner.run({
      agentId,
      threadId,
      prompt,
      userId,
      orgId,
      db,
      llmConfig: config.llmConfig,
      sandboxConfig: config.sandboxConfig,
      tools: config.tools,
      maxSteps: 10,
      onEvent,
    })

    return { threadId }
  }
}
