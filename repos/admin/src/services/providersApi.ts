import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Provider } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Providers API Service
 * Handles all Provider-related API operations
 *
 * Providers are "exclusive arc" resources — they belong to either an org OR a project.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/providers
 *   Project-scoped: /orgs/:orgId/projects/:projectId/providers
 */
export class ProvidersApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`providers`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/providers`
      : `/orgs/${orgId}/providers`
  }

  /**
   * Get all providers
   * @param orgId - Organization ID
   * @param projectId - Optional Project ID (for project-scoped providers)
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all providers
   */
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Provider[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Provider[]>({
      data: rest,
      path: this.#path(orgId, projectId),
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
   * @param orgId - Organization ID
   * @param id - Provider ID
   * @param projectId - Optional Project ID (for project-scoped providers)
   * @returns Provider object
   */
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Provider>> {
    const resp = await this.api.get<Provider>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param data - Provider data
   * @param projectId - Optional Project ID (for project-scoped providers)
   * @returns Created provider
   */
  async create(
    orgId: string,
    data: Partial<Provider>,
    projectId?: string
  ): Promise<TApiRes<Provider>> {
    const resp = await this.api.post<Provider>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Update existing provider
   * @param orgId - Organization ID
   * @param id - Provider ID
   * @param data - Updated provider data
   * @param projectId - Optional Project ID (for project-scoped providers)
   * @returns Updated provider
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Provider>,
    projectId?: string
  ): Promise<TApiRes<Provider>> {
    const resp = await this.api.put<Provider>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Provider`))

    return {
      ...resp,
      data: resp.data ? new Provider(resp.data) : undefined,
    }
  }

  /**
   * Delete provider
   * @param orgId - Organization ID
   * @param id - Provider ID
   * @param projectId - Optional Project ID (for project-scoped providers)
   * @returns Success status
   */
  async delete(
    orgId: string,
    id: string,
    projectId?: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Provider`))

    return resp
  }
}

// Export singleton instance
export const providersApi = new ProvidersApi()
