import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Function as TDFunction } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Functions API Service
 * Handles all Function-related API operations
 */
export class FunctionsApi extends BaseApi {
  private readonly path = `/functions`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all functions
   * @param data - Optional query parameters (projectId, limit, offset, etc.)
   * @returns List of all functions
   */
  async list(data?: Record<string, any>): Promise<TApiRes<TDFunction[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<TDFunction[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Functions list`))

    return {
      ...resp,
      data: resp.data?.map((func) => new TDFunction(func)) || [],
    }
  }

  /**
   * Get function by ID
   * @param id - Function ID
   * @returns Function object
   */
  async get(id: string): Promise<TApiRes<TDFunction>> {
    const resp = await this.api.get<TDFunction>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Function`))

    return {
      ...resp,
      data: resp.data ? new TDFunction(resp.data) : undefined,
    }
  }

  /**
   * Create new function
   * @param data - Function data
   * @returns Created function
   */
  async create(data: Partial<TDFunction>): Promise<TApiRes<TDFunction>> {
    const resp = await this.api.post<TDFunction>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Function`))

    return {
      ...resp,
      data: resp.data ? new TDFunction(resp.data) : undefined,
    }
  }

  /**
   * Update existing function
   * @param id - Function ID
   * @param data - Updated function data
   * @returns Updated function
   */
  async update(id: string, data: Partial<TDFunction>): Promise<TApiRes<TDFunction>> {
    const resp = await this.api.put<TDFunction>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Function`))

    return {
      ...resp,
      data: resp.data ? new TDFunction(resp.data) : undefined,
    }
  }

  /**
   * Delete function
   * @param id - Function ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Function`))

    return resp
  }
}

// Export singleton instance
export const functionsApi = new FunctionsApi()
