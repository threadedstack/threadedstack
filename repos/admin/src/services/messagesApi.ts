import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Message } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Messages API Service
 *
 * Messages are nested under agent-scoped threads. Backend route:
 *   GET /orgs/:orgId/agents/:agentId/threads/:threadId/messages
 */
export class MessagesApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`messages`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    byThread: (threadId: string) => [...this.cache.all(), `thread`, threadId] as const,
  }

  #path(orgId: string, agentId: string, threadId: string) {
    return `/orgs/${orgId}/agents/${agentId}/threads/${threadId}/messages`
  }

  async listByThread(
    orgId: string,
    agentId: string,
    threadId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Message[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Message[]>({
      data: rest,
      path: this.#path(orgId, agentId, threadId),
      queryKey: queryKey || this.cache.byThread(threadId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Messages`))

    return {
      ...resp,
      data: resp?.data?.map?.((message) => new Message(message)) || [],
    }
  }
  async update(
    orgId: string,
    agentId: string,
    threadId: string,
    messageId: string,
    data: Record<string, any>
  ): Promise<TApiRes<Message>> {
    const resp = await this.api.put<Message>({
      data,
      path: `${this.#path(orgId, agentId, threadId)}/${messageId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Message`))

    return {
      ...resp,
      data: resp.data ? new Message(resp.data) : undefined,
    }
  }

  async delete(
    orgId: string,
    agentId: string,
    threadId: string,
    messageId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, agentId, threadId)}/${messageId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Message`))

    return resp
  }
}

export const messagesApi = new MessagesApi()
