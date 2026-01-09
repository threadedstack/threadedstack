import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Endpoint } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Endpoints API Service
 * Handles all Endpoint-related API operations
 */
export class EndpointsApi extends BaseApi {
  private readonly path = `/endpoints`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all endpoints
   * @param data - Optional query parameters (repoId, limit, offset, etc.)
   * @returns List of all endpoints
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Endpoint[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Endpoint[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Endpoints list`))

    return {
      ...resp,
      data: resp.data?.map((endpoint) => new Endpoint(endpoint)) || [],
    }
  }

  /**
   * Get endpoint by ID
   * @param id - Endpoint ID
   * @returns Endpoint object
   */
  async get(id: string): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.get<Endpoint>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Endpoint`))

    return {
      ...resp,
      data: resp.data ? new Endpoint(resp.data) : undefined,
    }
  }

  /**
   * Create new endpoint
   * @param data - Endpoint data
   * @returns Created endpoint
   */
  async create(data: Partial<Endpoint>): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.post<Endpoint>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Endpoint`))

    return {
      ...resp,
      data: resp.data ? new Endpoint(resp.data) : undefined,
    }
  }

  /**
   * Update existing endpoint
   * @param id - Endpoint ID
   * @param data - Updated endpoint data
   * @returns Updated endpoint
   */
  async update(id: string, data: Partial<Endpoint>): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.put<Endpoint>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Endpoint`))

    return {
      ...resp,
      data: resp.data ? new Endpoint(resp.data) : undefined,
    }
  }

  /**
   * Delete endpoint
   * @param id - Endpoint ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Endpoint`))

    return resp
  }
}

// Export singleton instance
export const endpointsApi = new EndpointsApi()
