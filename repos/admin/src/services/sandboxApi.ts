import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type { TSandboxConnectResponse, TSandboxSession } from '@tdsk/domain'

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
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
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
      queryKey: queryKey || this.cache.list(orgId),
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

  async start(
    orgId: string,
    id: string,
    data?: { projectId?: string }
  ): Promise<TApiRes<{ podName: string }>> {
    const resp = await this.api.post<{ podName: string }>({
      data,
      path: `${this.#path(orgId)}/${id}/start`,
    })
    resp.error && (await this._onError(resp.error, `Failed to start sandbox`))
    return resp
  }

  async stop(
    orgId: string,
    id: string,
    podName: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      data: { podName },
      path: `${this.#path(orgId)}/${id}/stop`,
    })
    resp.error && (await this._onError(resp.error, `Failed to stop sandbox`))
    return resp
  }

  async connect(orgId: string, id: string): Promise<TApiRes<TSandboxConnectResponse>> {
    const resp = await this.api.post<TSandboxConnectResponse>({
      path: `${this.#path(orgId)}/${id}/connect`,
    })
    resp.error && (await this._onError(resp.error, `Failed to connect to sandbox`))
    return resp
  }

  async status(
    orgId: string,
    id: string,
    podName: string
  ): Promise<TApiRes<{ podName: string; state: string }>> {
    const resp = await this.api.get<{ podName: string; state: string }>({
      path: `${this.#path(orgId)}/${id}/status?podName=${podName}`,
    })
    resp.error && (await this._onError(resp.error, `Failed to get sandbox status`))
    return resp
  }

  async sessions(orgId: string, id: string): Promise<TApiRes<TSandboxSession[]>> {
    const resp = await this.api.get<TSandboxSession[]>({
      path: `${this.#path(orgId)}/${id}/sessions`,
    })
    resp.error && (await this._onError(resp.error, `Failed to get sandbox sessions`))
    return resp
  }

  async copy(orgId: string, id: string, name: string): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.post<Sandbox>({
      data: { orgId, name },
      path: `${this.#path(orgId)}/${id}/copy`,
    })
    resp.error && (await this._onError(resp.error, `Failed to copy sandbox`))
    return {
      ...resp,
      data: resp.data ? new Sandbox(resp.data) : undefined,
    }
  }
}

// Export singleton instance
export const sandboxApi = new SandboxApi()
