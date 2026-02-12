import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Thread } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Threads API Service
 * Handles all Thread-related API operations
 *
 * Threads are agent-scoped: /orgs/:orgId/agents/:agentId/threads
 */
export class ThreadsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`threads`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, agentId: string) {
    return `/orgs/${orgId}/agents/${agentId}/threads`
  }

  async list(
    orgId: string,
    agentId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Thread[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Thread[]>({
      data: rest,
      path: this.#path(orgId, agentId),
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Threads list`))

    return {
      ...resp,
      data: resp?.data?.map?.((thread) => new Thread(thread)) || [],
    }
  }

  async get(orgId: string, agentId: string, id: string): Promise<TApiRes<Thread>> {
    const resp = await this.api.get<Thread>({
      path: `${this.#path(orgId, agentId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  async create(
    orgId: string,
    agentId: string,
    data: Partial<Thread>
  ): Promise<TApiRes<Thread>> {
    const resp = await this.api.post<Thread>({
      data,
      path: this.#path(orgId, agentId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  async update(
    orgId: string,
    agentId: string,
    id: string,
    data: Partial<Thread>
  ): Promise<TApiRes<Thread>> {
    const resp = await this.api.put<Thread>({
      data,
      path: `${this.#path(orgId, agentId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  async delete(
    orgId: string,
    agentId: string,
    id: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, agentId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Thread`))

    return resp
  }

  async listMessages(
    orgId: string,
    agentId: string,
    threadId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<any[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<any[]>({
      data: rest,
      path: `${this.#path(orgId, agentId)}/${threadId}/messages`,
      queryKey: queryKey || [`threads`, `messages`, threadId],
    })

    resp.error && (await this._onError(resp.error, `Failed to load messages`))

    return resp
  }
  async branch(
    orgId: string,
    agentId: string,
    threadId: string,
    messageId: string
  ): Promise<TApiRes<Thread & { messages?: any[] }>> {
    const resp = await this.api.post<Thread & { messages?: any[] }>({
      data: { messageId },
      path: `${this.#path(orgId, agentId)}/${threadId}/branch`,
    })

    resp.error && (await this._onError(resp.error, `Failed to branch Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }
}

export const threadsApi = new ThreadsApi()
