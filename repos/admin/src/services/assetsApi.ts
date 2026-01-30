import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Asset } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Assets API Service
 * Handles all Asset-related API operations
 */
export class AssetsApi extends BaseApi {
  private readonly path = `/assets`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    byThread: (threadId: string) => [...this.cache.all(), `thread`, threadId] as const,
    byMessage: (messageId: string) =>
      [...this.cache.all(), `message`, messageId] as const,
  }

  /**
   * Get all assets
   * @param data - Optional query parameters (projectId, threadId, messageId, limit, offset, etc.)
   * @returns List of all assets
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Asset[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Asset[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Assets list`))

    return {
      ...resp,
      data: resp?.data?.map?.((asset) => new Asset(asset)) || [],
    }
  }

  /**
   * Get assets by thread ID
   * @param threadId - Thread ID
   * @param data - Optional query parameters
   * @returns List of assets for the thread
   */
  async getByThread(
    threadId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Asset[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Asset[]>({
      data: { threadId, ...rest },
      path: this.path,
      queryKey: queryKey || this.cache.byThread(threadId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Assets for thread`))

    return {
      ...resp,
      data: resp?.data?.map?.((asset) => new Asset(asset)) || [],
    }
  }

  /**
   * Get assets by message ID
   * @param messageId - Message ID
   * @param data - Optional query parameters
   * @returns List of assets for the message
   */
  async getByMessage(
    messageId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Asset[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Asset[]>({
      data: { messageId, ...rest },
      path: this.path,
      queryKey: queryKey || this.cache.byMessage(messageId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Assets for message`))

    return {
      ...resp,
      data: resp?.data?.map?.((asset) => new Asset(asset)) || [],
    }
  }

  /**
   * Get asset by ID
   * @param id - Asset ID
   * @returns Asset object
   */
  async get(id: string): Promise<TApiRes<Asset>> {
    const resp = await this.api.get<Asset>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Asset`))

    return {
      ...resp,
      data: resp.data ? new Asset(resp.data) : undefined,
    }
  }

  /**
   * Create new asset
   * @param data - Asset data
   * @returns Created asset
   */
  async create(data: Partial<Asset>): Promise<TApiRes<Asset>> {
    const resp = await this.api.post<Asset>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Asset`))

    return {
      ...resp,
      data: resp.data ? new Asset(resp.data) : undefined,
    }
  }

  /**
   * Update existing asset
   * @param id - Asset ID
   * @param data - Updated asset data
   * @returns Updated asset
   */
  async update(id: string, data: Partial<Asset>): Promise<TApiRes<Asset>> {
    const resp = await this.api.put<Asset>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Asset`))

    return {
      ...resp,
      data: resp.data ? new Asset(resp.data) : undefined,
    }
  }

  /**
   * Delete asset
   * @param id - Asset ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Asset`))

    return resp
  }
}

// Export singleton instance
export const assetsApi = new AssetsApi()
