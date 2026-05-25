import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type { PermissionOverride } from '@tdsk/domain'

import { BaseApi } from '@TAF/services/api'

/**
 * Permission Overrides API Service
 * Handles all Permission Override-related API operations
 *
 * Overrides are "exclusive arc" resources -- they belong to either an org OR a project.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/overrides
 *   Project-scoped: /orgs/:orgId/projects/:projectId/overrides
 */
export class PermissionOverridesApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`overrides`] as const,
    list: (orgId: string, projectId?: string) => {
      const ref = projectId || orgId
      return [...this.cache.all(), `list`, ref] as const
    },
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/overrides`
      : `/orgs/${orgId}/overrides`
  }

  /**
   * Get all permission overrides for an org or project
   * @param orgId - Organization ID
   * @param projectId - Optional Project ID (for project-scoped overrides)
   * @returns List of all permission overrides
   */
  async list(orgId: string, projectId?: string): Promise<TApiRes<PermissionOverride[]>> {
    const resp = await this.api.get<PermissionOverride[]>({
      path: this.#path(orgId, projectId),
      queryKey: this.cache.list(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load permission overrides`))

    return {
      ...resp,
      data: resp.data || [],
    }
  }

  /**
   * Create a new permission override
   * @param orgId - Organization ID
   * @param data - Override data (userId, permission, effect, etc.)
   * @param projectId - Optional Project ID (for project-scoped overrides)
   * @returns Created permission override
   */
  async create(
    orgId: string,
    data: Omit<PermissionOverride, 'id' | 'grantedBy'>,
    projectId?: string
  ): Promise<TApiRes<PermissionOverride>> {
    const resp = await this.api.post<PermissionOverride>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error &&
      (await this._onError(resp.error, `Failed to create permission override`))

    return resp
  }

  /**
   * Update a permission override
   * @param orgId - Organization ID
   * @param overrideId - Override ID to update
   * @param data - Fields to update (effect, reason, expiresAt)
   * @param projectId - Optional Project ID (for project-scoped overrides)
   * @returns Updated permission override
   */
  async update(
    orgId: string,
    overrideId: string,
    data: Partial<Pick<PermissionOverride, `effect` | `reason` | `expiresAt`>>,
    projectId?: string
  ): Promise<TApiRes<PermissionOverride>> {
    const resp = await this.api.patch<PermissionOverride>({
      data,
      path: `${this.#path(orgId, projectId)}/${overrideId}`,
    })

    resp.error &&
      (await this._onError(resp.error, `Failed to update permission override`))

    return resp
  }

  /**
   * Delete a permission override
   * @param orgId - Organization ID
   * @param overrideId - Override ID
   * @param projectId - Optional Project ID (for project-scoped overrides)
   * @returns Success status
   */
  async remove(
    orgId: string,
    overrideId: string,
    projectId?: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId)}/${overrideId}`,
    })

    resp.error &&
      (await this._onError(resp.error, `Failed to delete permission override`))

    return resp
  }
}

export const permissionOverridesApi = new PermissionOverridesApi()
