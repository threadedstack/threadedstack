import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Thread } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Threads API Service
 * Handles all Thread-related API operations
 */
export class ThreadsApi extends BaseApi {
  private readonly path = `/threads`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all threads
   * @param data - Optional query parameters (projectId, orgId, limit, offset, etc.)
   * @returns List of all threads
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Thread[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Thread[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Threads list`))

    return {
      ...resp,
      data: resp?.data?.map?.((thread) => new Thread(thread)) || [],
    }
  }

  /**
   * Get thread by ID
   * @param id - Thread ID
   * @returns Thread object
   */
  async get(id: string): Promise<TApiRes<Thread>> {
    const resp = await this.api.get<Thread>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  /**
   * Create new thread
   * @param data - Thread data
   * @returns Created thread
   */
  async create(data: Partial<Thread>): Promise<TApiRes<Thread>> {
    const resp = await this.api.post<Thread>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  /**
   * Update existing thread
   * @param id - Thread ID
   * @param data - Updated thread data
   * @returns Updated thread
   */
  async update(id: string, data: Partial<Thread>): Promise<TApiRes<Thread>> {
    const resp = await this.api.put<Thread>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Thread`))

    return {
      ...resp,
      data: resp.data ? new Thread(resp.data) : undefined,
    }
  }

  /**
   * Delete thread
   * @param id - Thread ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Thread`))

    return resp
  }
}

// Export singleton instance
export const threadsApi = new ThreadsApi()
