import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Endpoint } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Endpoints API Service
 * Handles all Endpoint-related API operations
 */
export class EndpointsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`endpoints`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/endpoints`
  }

  /**
   * Get all endpoints
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all endpoints
   */
  async list(
    orgId: string,
    projectId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Endpoint[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Endpoint[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Endpoints list`))

    return {
      ...resp,
      data: resp.data?.map((endpoint) => new Endpoint(endpoint)) || [],
    }
  }

  /**
   * Get endpoint by ID
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param id - Endpoint ID
   * @returns Endpoint object
   */
  async get(orgId: string, projectId: string, id: string): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.get<Endpoint>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param data - Endpoint data
   * @returns Created endpoint
   */
  async create(
    orgId: string,
    projectId: string,
    data: Partial<Endpoint>
  ): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.post<Endpoint>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Endpoint`))

    return {
      ...resp,
      data: resp.data ? new Endpoint(resp.data) : undefined,
    }
  }

  /**
   * Update existing endpoint
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param id - Endpoint ID
   * @param data - Updated endpoint data
   * @returns Updated endpoint
   */
  async update(
    orgId: string,
    projectId: string,
    id: string,
    data: Partial<Endpoint>
  ): Promise<TApiRes<Endpoint>> {
    const resp = await this.api.put<Endpoint>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Endpoint`))

    return {
      ...resp,
      data: resp.data ? new Endpoint(resp.data) : undefined,
    }
  }

  /**
   * Delete endpoint
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param id - Endpoint ID
   * @returns Success status
   */
  async delete(
    orgId: string,
    projectId: string,
    id: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Endpoint`))

    return resp
  }
}

// Export singleton instance
export const endpointsApi = new EndpointsApi()
