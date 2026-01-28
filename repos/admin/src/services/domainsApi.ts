import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Domain } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Domains API Service
 * Handles all Domain-related API operations
 */
export class DomainsApi extends BaseApi {
  private readonly path = `/domains`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all domains
   * @param data - Optional query parameters (orgId, projectId, limit, offset, etc.)
   * @returns List of all domains
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Domain[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Domain[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Domains list`))

    return {
      ...resp,
      data: resp.data?.map?.((domain) => new Domain(domain)) || [],
    }
  }

  /**
   * Get domain by ID
   * @param id - Domain ID
   * @returns Domain object
   */
  async get(id: string): Promise<TApiRes<Domain>> {
    const resp = await this.api.get<Domain>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Domain`))

    return {
      ...resp,
      data: resp.data ? new Domain(resp.data) : undefined,
    }
  }

  /**
   * Create new domain
   * @param data - Domain data
   * @returns Created domain
   */
  async create(data: Partial<Domain>): Promise<TApiRes<Domain>> {
    const resp = await this.api.post<Domain>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Domain`))

    return {
      ...resp,
      data: resp.data ? new Domain(resp.data) : undefined,
    }
  }

  /**
   * Update existing domain
   * @param id - Domain ID
   * @param data - Updated domain data
   * @returns Updated domain
   */
  async update(id: string, data: Partial<Domain>): Promise<TApiRes<Domain>> {
    const resp = await this.api.put<Domain>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Domain`))

    return {
      ...resp,
      data: resp.data ? new Domain(resp.data) : undefined,
    }
  }

  /**
   * Delete domain
   * @param id - Domain ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Domain`))

    return resp
  }
}

// Export singleton instance
export const domainsApi = new DomainsApi()
