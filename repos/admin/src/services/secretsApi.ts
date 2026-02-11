import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Secret } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Secrets API Service
 * Handles all Secret-related API operations
 *
 * Secrets are "exclusive arc" resources — they belong to either an org OR a project.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/secrets
 *   Project-scoped: /orgs/:orgId/projects/:projectId/secrets
 */
export class SecretsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`secrets`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/secrets`
      : `/orgs/${orgId}/secrets`
  }

  /**
   * Get all secrets
   * @param orgId - Organization ID
   * @param projectId - Optional Project ID (for project-scoped secrets)
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all secrets
   */
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Secret[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Secret[]>({
      data: rest,
      path: this.#path(orgId, projectId),
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
   * @param orgId - Organization ID
   * @param id - Secret ID
   * @param projectId - Optional Project ID (for project-scoped secrets)
   * @returns Secret object
   */
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Secret>> {
    const resp = await this.api.get<Secret>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param data - Secret data
   * @param projectId - Optional Project ID (for project-scoped secrets)
   * @returns Created secret
   */
  async create(
    orgId: string,
    data: Partial<Secret>,
    projectId?: string
  ): Promise<TApiRes<Secret>> {
    const resp = await this.api.post<Secret>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Secret`))

    return {
      ...resp,
      data: resp.data ? new Secret(resp.data) : undefined,
    }
  }

  /**
   * Update existing secret
   * @param orgId - Organization ID
   * @param id - Secret ID
   * @param data - Updated secret data
   * @param projectId - Optional Project ID (for project-scoped secrets)
   * @returns Updated secret
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Secret>,
    projectId?: string
  ): Promise<TApiRes<Secret>> {
    const resp = await this.api.put<Secret>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Secret`))

    return {
      ...resp,
      data: resp.data ? new Secret(resp.data) : undefined,
    }
  }

  /**
   * Delete secret
   * @param orgId - Organization ID
   * @param id - Secret ID
   * @param projectId - Optional Project ID (for project-scoped secrets)
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

    resp.error && (await this._onError(resp.error, `Failed to delete Secret`))

    return resp
  }
}

// Export singleton instance
export const secretsApi = new SecretsApi()
