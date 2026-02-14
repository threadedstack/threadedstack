import type { IAgentRunnerDB } from '@tdsk/agent'
import type { TMessageContent } from '@tdsk/domain'
import type { ApiClient } from '@TRL/api'

/**
 * HTTP-based implementation of IAgentRunnerDB.
 * Persists messages through the backend API instead of direct DB access.
 */
export class HttpMessageAdapter implements IAgentRunnerDB {
  #client: ApiClient
  #orgId: string
  #agentId: string

  constructor(client: ApiClient, orgId: string, agentId: string) {
    this.#client = client
    this.#orgId = orgId
    this.#agentId = agentId
  }

  async listMessages(opts: {
    where: { threadId: string }
    limit: number
    offset: number
  }): Promise<{ data?: Array<{ type: string; content: TMessageContent[] }> }> {
    const messages = await this.#client.listMessages(
      this.#orgId,
      this.#agentId,
      opts.where.threadId
    )

    return {
      data: (messages || []) as Array<{ type: string; content: TMessageContent[] }>,
    }
  }

  async createMessage(data: {
    threadId: string
    type: string
    content: TMessageContent[]
    orgId: string
  }): Promise<void> {
    await this.#client.createMessage(this.#orgId, this.#agentId, data.threadId, {
      type: data.type,
      content: data.content,
      orgId: data.orgId,
    })
  }
}
