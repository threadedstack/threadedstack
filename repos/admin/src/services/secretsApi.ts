import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Secret } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Secrets API Service
 * Handles all Secret-related API operations
 */
export class SecretsApi extends BaseApi {
  private readonly path = `/secrets`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all secrets
   * @param data - Optional query parameters (orgId, projectId, limit, offset, etc.)
   * @returns List of all secrets
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Secret[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Secret[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Secrets list`))

    return {
      ...resp,
      data: resp.data?.map?.((secret) => new Secret(secret)) || [],
    }
  }

  /**
   * Get secret by ID
   * @param id - Secret ID
   * @returns Secret object
   */
  async get(id: string): Promise<TApiRes<Secret>> {
    const resp = await this.api.get<Secret>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Secret`))

    return {
      ...resp,
      data: resp.data ? new Secret(resp.data) : undefined,
    }
  }

  /**
   * Create new secret
   * @param data - Secret data
   * @returns Created secret
   */
  async create(data: Partial<Secret>): Promise<TApiRes<Secret>> {
    const resp = await this.api.post<Secret>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Secret`))

    return {
      ...resp,
      data: resp.data ? new Secret(resp.data) : undefined,
    }
  }

  /**
   * Update existing secret
   * @param id - Provider ID
   * @param data - Updated secret data
   * @returns Updated secret
   */
  async update(id: string, data: Partial<Secret>): Promise<TApiRes<Secret>> {
    const resp = await this.api.put<Secret>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Secret`))

    return {
      ...resp,
      data: resp.data ? new Secret(resp.data) : undefined,
    }
  }

  /**
   * Delete secret
   * @param id - Secret ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Secret`))

    return resp
  }
}

// Export singleton instance
export const secretsApi = new SecretsApi()
