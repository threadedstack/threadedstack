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
  #path(orgId: string) {
    return `/orgs/${orgId}/api-keys`
  }

  cache: TApiCacheKeys = {
    all: () => [`/api-keys`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all API keys (masked)
   * @param orgId - Organization ID
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all API keys with masked values
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<ApiKey[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<ApiKey[]>({
      data: rest,
      path: this.#path(orgId),
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
   * @param orgId - Organization ID
   * @param id - API Key ID
   * @returns API Key object (masked)
   */
  async get(orgId: string, id: string): Promise<TApiRes<ApiKey>> {
    const resp = await this.api.get<ApiKey>({
      path: `${this.#path(orgId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param data - API key data (name, scopes, expiresAt)
   * @returns Created API key WITH the raw key (only shown once!)
   */
  async create(
    orgId: string,
    data: Partial<ApiKey>
  ): Promise<TApiRes<TCreateApiKeyResponse>> {
    const resp = await this.api.post<TCreateApiKeyResponse>({
      data,
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create API key`))

    return resp
  }

  /**
   * Update API key
   * @param orgId - Organization ID
   * @param id - API Key ID
   * @param data - Update data (name, scopes, active)
   * @returns Updated API key
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<ApiKey>
  ): Promise<TApiRes<ApiKey>> {
    const resp = await this.api.put<ApiKey>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update API key`))

    return {
      ...resp,
      data: resp.data ? new ApiKey(resp.data) : undefined,
    }
  }

  /**
   * Revoke (delete) API key
   * @param orgId - Organization ID
   * @param id - API Key ID
   * @returns Success status
   */
  async revoke(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to revoke API key`))

    return resp
  }
}

// Export singleton instance
export const apiKeysApi = new ApiKeysApi()
