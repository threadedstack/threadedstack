import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Domain } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Domains API Service
 * Handles all Domain-related API operations
 *
 * Domains are "exclusive arc" resources — they belong to either an org OR a project.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/domains
 *   Project-scoped: /orgs/:orgId/projects/:projectId/domains
 */
export class DomainsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`domains`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/domains`
      : `/orgs/${orgId}/domains`
  }

  /**
   * Get all domains
   * @param orgId - Organization ID
   * @param projectId - Optional Project ID (for project-scoped domains)
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all domains
   */
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Domain[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Domain[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId || `org`),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Domains list`))

    return {
      ...resp,
      data: resp.data?.map?.((domain) => new Domain(domain)) || [],
    }
  }

  /**
   * Get domain by ID
   * @param orgId - Organization ID
   * @param id - Domain ID
   * @param projectId - Optional Project ID (for project-scoped domains)
   * @returns Domain object
   */
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Domain>> {
    const resp = await this.api.get<Domain>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param data - Domain data
   * @param projectId - Optional Project ID (for project-scoped domains)
   * @returns Created domain
   */
  async create(
    orgId: string,
    data: Partial<Domain>,
    projectId?: string
  ): Promise<TApiRes<Domain>> {
    const resp = await this.api.post<Domain>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Domain`))

    return {
      ...resp,
      data: resp.data ? new Domain(resp.data) : undefined,
    }
  }

  /**
   * Update existing domain
   * @param orgId - Organization ID
   * @param id - Domain ID
   * @param data - Updated domain data
   * @param projectId - Optional Project ID (for project-scoped domains)
   * @returns Updated domain
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Domain>,
    projectId?: string
  ): Promise<TApiRes<Domain>> {
    const resp = await this.api.put<Domain>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Domain`))

    return {
      ...resp,
      data: resp.data ? new Domain(resp.data) : undefined,
    }
  }

  /**
   * Delete domain
   * @param orgId - Organization ID
   * @param id - Domain ID
   * @param projectId - Optional Project ID (for project-scoped domains)
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

    resp.error && (await this._onError(resp.error, `Failed to delete Domain`))

    return resp
  }
}

// Export singleton instance
export const domainsApi = new DomainsApi()
