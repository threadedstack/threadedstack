import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Sandbox } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Sandbox API Service
 * Handles all Sandbox-related API operations
 *
 * Sandboxes are org-scoped resources.
 * Backend mount point: /orgs/:orgId/sandboxes
 */
export class SandboxApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`sandboxes`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/sandboxes`
  }

  /**
   * Get all sandboxes for an org
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Sandbox[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Sandbox[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Sandbox configs list`))

    return {
      ...resp,
      data: resp?.data?.map?.((s) => new Sandbox(s)) || [],
    }
  }

  /**
   * Get sandbox by ID
   */
  async get(orgId: string, id: string): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.get<Sandbox>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  /**
   * Create new sandbox
   */
  async create(orgId: string, data: Partial<Sandbox>): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.post<Sandbox>({
      data,
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  /**
   * Update existing sandbox
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Sandbox>
  ): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.put<Sandbox>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Sandbox config`))

    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }

  /**
   * Delete sandbox
   */
  async delete(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Sandbox config`))

    return resp
  }
}

// Export singleton instance
export const sandboxApi = new SandboxApi()
