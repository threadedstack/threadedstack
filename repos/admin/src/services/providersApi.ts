import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Provider } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Providers API Service
 * Handles all Provider-related API operations
 */
export class ProvidersApi extends BaseApi {
  private readonly path = `/providers`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all providers
   * @param data - Optional query parameters (teamId, limit, offset, etc.)
   * @returns List of all providers
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Provider[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Provider[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Providers list`))

    return {
      ...resp,
      data: resp.data?.map((provider) => new Provider(provider)) || [],
    }
  }

  /**
   * Get provider by ID
   * @param id - Provider ID
   * @returns Provider object
   */
  async get(id: string): Promise<TApiRes<Provider>> {
    const resp = await this.api.get<Provider>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Create new provider
   * @param data - Provider data
   * @returns Created provider
   */
  async create(data: Partial<Provider>): Promise<TApiRes<Provider>> {
    const resp = await this.api.post<Provider>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Update existing provider
   * @param id - Provider ID
   * @param data - Updated provider data
   * @returns Updated provider
   */
  async update(id: string, data: Partial<Provider>): Promise<TApiRes<Provider>> {
    const resp = await this.api.put<Provider>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Delete provider
   * @param id - Provider ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Provider`))

    return resp
  }
}

// Export singleton instance
export const providersApi = new ProvidersApi()
