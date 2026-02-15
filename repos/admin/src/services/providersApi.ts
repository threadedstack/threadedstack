import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Provider } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Providers API Service
 * Handles all Provider-related API operations
 *
 * Providers are org-scoped resources.
 * Backend mount point: /orgs/:orgId/providers
 */
export class ProvidersApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`providers`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/providers`
  }

  /**
   * Get all providers for an org
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Provider[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Provider[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Providers list`))

    return {
      ...resp,
      data: resp?.data?.map?.((provider) => new Provider(provider)) || [],
    }
  }

  /**
   * Get provider by ID
   */
  async get(orgId: string, id: string): Promise<TApiRes<Provider>> {
    const resp = await this.api.get<Provider>({
      path: `${this.#path(orgId)}/${id}`,
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
   */
  async create(orgId: string, data: Partial<Provider>): Promise<TApiRes<Provider>> {
    const resp = await this.api.post<Provider>({
      data,
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Update existing provider
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Provider>
  ): Promise<TApiRes<Provider>> {
    const resp = await this.api.put<Provider>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Delete provider
   */
  async delete(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Provider`))

    return resp
  }
}

// Export singleton instance
export const providersApi = new ProvidersApi()
