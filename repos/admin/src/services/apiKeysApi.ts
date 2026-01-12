import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { ApiKey } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Response type for API key creation that includes the raw key
 */
export type TCreateApiKeyResponse = ApiKey & {
  key: string
  warning: string
}

/**
 * API Keys API Service
 * Handles all API Key-related API operations
 */
export class ApiKeysApi extends BaseApi {
  private readonly path = `/api-keys`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all API keys (masked)
   * @param data - Optional query parameters (orgId, projectId, limit, offset, etc.)
   * @returns List of all API keys with masked values
   */
  async list(data?: Record<string, any>): Promise<TApiRes<ApiKey[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<ApiKey[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load API keys list`))

    return {
      ...resp,
      data: resp.data?.map?.((apiKey) => new ApiKey(apiKey)) || [],
    }
  }

  /**
   * Get API key by ID (masked)
   * @param id - API Key ID
   * @returns API Key object (masked)
   */
  async get(id: string): Promise<TApiRes<ApiKey>> {
    const resp = await this.api.get<ApiKey>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load API key`))

    return {
      ...resp,
      data: resp.data ? new ApiKey(resp.data) : undefined,
    }
  }

  /**
   * Create new API key
   * @param data - API key data (name, orgId/projectId, scopes, expiresAt)
   * @returns Created API key WITH the raw key (only shown once!)
   */
  async create(data: Partial<ApiKey>): Promise<TApiRes<TCreateApiKeyResponse>> {
    const resp = await this.api.post<TCreateApiKeyResponse>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create API key`))

    return resp
  }

  /**
   * Update API key
   * @param id - API Key ID
   * @param data - Update data (name, scopes, active)
   * @returns Updated API key
   */
  async update(id: string, data: Partial<ApiKey>): Promise<TApiRes<ApiKey>> {
    const resp = await this.api.put<ApiKey>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update API key`))

    return {
      ...resp,
      data: resp.data ? new ApiKey(resp.data) : undefined,
    }
  }

  /**
   * Revoke (delete) API key
   * @param id - API Key ID
   * @returns Success status
   */
  async revoke(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to revoke API key`))

    return resp
  }
}

// Export singleton instance
export const apiKeysApi = new ApiKeysApi()
