import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Message } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Messages API Service
 * Handles all Message-related API operations
 */
export class MessagesApi extends BaseApi {
  private readonly path = `/messages`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    byThread: (threadId: string) => [...this.cache.all(), `thread`, threadId] as const,
  }

  /**
   * Get all messages
   * @param data - Optional query parameters (threadId, projectId, limit, offset, etc.)
   * @returns List of all messages
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Message[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Message[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Messages list`))

    return {
      ...resp,
      data: resp?.data?.map?.((message) => new Message(message)) || [],
    }
  }

  /**
   * Get messages by thread ID
   * @param threadId - Thread ID
   * @param data - Optional query parameters
   * @returns List of messages for the thread
   */
  async getByThread(
    threadId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Message[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Message[]>({
      data: { threadId, ...rest },
      path: this.path,
      queryKey: queryKey || this.cache.byThread(threadId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Messages for thread`))

    return {
      ...resp,
      data: resp?.data?.map?.((message) => new Message(message)) || [],
    }
  }

  /**
   * Get message by ID
   * @param id - Message ID
   * @returns Message object
   */
  async get(id: string): Promise<TApiRes<Message>> {
    const resp = await this.api.get<Message>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Message`))

    return {
      ...resp,
      data: resp.data ? new Message(resp.data) : undefined,
    }
  }

  /**
   * Create new message
   * @param data - Message data
   * @returns Created message
   */
  async create(data: Partial<Message>): Promise<TApiRes<Message>> {
    const resp = await this.api.post<Message>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Message`))

    return {
      ...resp,
      data: resp.data ? new Message(resp.data) : undefined,
    }
  }

  /**
   * Update existing message
   * @param id - Message ID
   * @param data - Updated message data
   * @returns Updated message
   */
  async update(id: string, data: Partial<Message>): Promise<TApiRes<Message>> {
    const resp = await this.api.put<Message>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Message`))

    return {
      ...resp,
      data: resp.data ? new Message(resp.data) : undefined,
    }
  }

  /**
   * Delete message
   * @param id - Message ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Message`))

    return resp
  }
}

// Export singleton instance
export const messagesApi = new MessagesApi()
