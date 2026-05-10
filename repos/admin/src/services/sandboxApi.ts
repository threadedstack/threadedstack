import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type {
  TSandboxSession,
  TSandboxStopResponse,
  TSandboxProjectConfig,
  TSandboxConnectResponse,
} from '@tdsk/domain'

import { Sandbox } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Sandbox API Service
 * Handles all Sandbox-related API operations
 *
 * Sandboxes are org-scoped resources but can also be linked to projects.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/sandboxes           (CRUD, copy, delete)
 *   Project-scoped: /orgs/:orgId/projects/:projectId/sandboxes  (operational: start, stop, connect, status, sessions)
 */
export class SandboxApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`sandboxes`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/sandboxes`
      : `/orgs/${orgId}/sandboxes`
  }

  #configPath(orgId: string, projectId: string, sandboxId: string) {
    return `/orgs/${orgId}/projects/${projectId}/sandboxes/${sandboxId}/config`
  }

  /**
   * Get all sandboxes for an org (or project)
   */
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Sandbox[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Sandbox[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId || `org`),
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
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.get<Sandbox>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
  async create(
    orgId: string,
    data: Partial<Sandbox>,
    projectId?: string
  ): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.post<Sandbox>({
      data,
      path: this.#path(orgId, projectId),
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
    data: Partial<Sandbox>,
    projectId?: string
  ): Promise<TApiRes<Sandbox>> {
    const resp = await this.api.put<Sandbox>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
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

  /**
   * Get project-level config overrides for a sandbox
   */
  async getConfig(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.get<TSandboxProjectConfig>({
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load sandbox config`))

    return resp
  }

  /**
   * Create or update project-level config overrides for a sandbox
   */
  async upsertConfig(
    orgId: string,
    projectId: string,
    sandboxId: string,
    data: Partial<TSandboxProjectConfig>
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.put<TSandboxProjectConfig>({
      data,
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to save sandbox config`))

    return resp
  }

  /**
   * Reset all project-level config overrides for a sandbox
   */
  async deleteConfig(
    orgId: string,
    projectId: string,
    sandboxId: string
  ): Promise<TApiRes<TSandboxProjectConfig>> {
    const resp = await this.api.delete<TSandboxProjectConfig>({
      path: this.#configPath(orgId, projectId, sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to reset sandbox config`))

    return resp
  }

  async start(
    orgId: string,
    projectId: string,
    id: string
  ): Promise<TApiRes<{ podName: string }>> {
    const resp = await this.api.post<{ podName: string }>({
      data: {},
      path: `${this.#path(orgId, projectId)}/${id}/start`,
    })
    resp.error && (await this._onError(resp.error, `Failed to start sandbox`))
    return resp
  }

  async stop(
    orgId: string,
    projectId: string,
    id: string,
    opts: { podName?: string; stopAll?: boolean; force?: boolean }
  ): Promise<TApiRes<TSandboxStopResponse>> {
    const resp = await this.api.delete<TSandboxStopResponse>({
      data: opts,
      path: `${this.#path(orgId, projectId)}/${id}/stop`,
    })
    resp.error && (await this._onError(resp.error, `Failed to stop sandbox`))
    return resp
  }

  async connect(
    orgId: string,
    projectId: string,
    id: string,
    opts?: { podName?: string; newInstance?: boolean }
  ): Promise<TApiRes<TSandboxConnectResponse>> {
    const resp = await this.api.post<TSandboxConnectResponse>({
      data: opts || {},
      path: `${this.#path(orgId, projectId)}/${id}/connect`,
    })
    resp.error && (await this._onError(resp.error, `Failed to connect to sandbox`))
    return resp
  }

  async status(
    orgId: string,
    projectId: string,
    id: string,
    podName: string
  ): Promise<TApiRes<{ podName: string; state: string }>> {
    const resp = await this.api.get<{ podName: string; state: string }>({
      path: `${this.#path(orgId, projectId)}/${id}/status?podName=${podName}`,
    })
    resp.error && (await this._onError(resp.error, `Failed to get sandbox status`))
    return resp
  }

  async sessions(
    orgId: string,
    projectId: string,
    id: string
  ): Promise<TApiRes<TSandboxSession[]>> {
    const resp = await this.api.get<TSandboxSession[]>({
      path: `${this.#path(orgId, projectId)}/${id}/sessions`,
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
