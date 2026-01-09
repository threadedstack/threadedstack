import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type { TConfig } from '@TAF/state/configs'

import { BaseApi } from '@TAF/services/api'

/**
 * Configs API Service
 * Handles all Config-related API operations
 */
export class ConfigsApi extends BaseApi {
  private readonly path = `/configs`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all configs
   * @param data - Optional query parameters (teamId, repoId, limit, offset, etc.)
   * @returns List of all configs
   */
  async list(data?: Record<string, any>): Promise<TApiRes<TConfig[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<TConfig[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Configs list`))

    return resp
  }

  /**
   * Get config by ID
   * @param id - Config ID
   * @returns Config object
   */
  async get(id: string): Promise<TApiRes<TConfig>> {
    const resp = await this.api.get<TConfig>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Config`))

    return resp
  }

  /**
   * Create new config
   * @param data - Config data
   * @returns Created config
   */
  async create(data: Partial<TConfig>): Promise<TApiRes<TConfig>> {
    const resp = await this.api.post<TConfig>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Config`))

    return resp
  }

  /**
   * Update existing config
   * @param id - Config ID
   * @param data - Updated config data
   * @returns Updated config
   */
  async update(id: string, data: Partial<TConfig>): Promise<TApiRes<TConfig>> {
    const resp = await this.api.put<TConfig>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Config`))

    return resp
  }

  /**
   * Delete config
   * @param id - Config ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Config`))

    return resp
  }
}

// Export singleton instance
export const configsApi = new ConfigsApi()
