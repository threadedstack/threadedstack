import type { TApiRes, TApiCacheKeys } from '@TTH/types'
import type {
  TSandboxSession,
  TSandboxConnectOpts,
  TSandboxConnectResponse,
  TSandboxInstancesResponse,
} from '@tdsk/domain'

import { Sandbox } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

/**
 * Sandbox API Service
 * Handles sandbox-related API operations for the threads SPA
 *
 * Sandboxes are org-scoped resources but operational endpoints (connect, start, etc.)
 * require project-scoped paths.
 * Backend mount points:
 *   Org-scoped:     /orgs/:orgId/sandboxes
 *   Project-scoped: /orgs/:orgId/projects/:projectId/sandboxes
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
   * Connect to a sandbox (starts pod + returns SSH credentials)
   * Uses project-scoped path — operational endpoints require projectId in the URL
   */
  async connect(
    orgId: string,
    projectId: string,
    id: string,
    opts?: TSandboxConnectOpts
  ): Promise<TApiRes<TSandboxConnectResponse>> {
    const resp = await this.api.post<TSandboxConnectResponse>({
      path: `${this.#path(orgId, projectId)}/${id}/connect`,
      data: opts ?? {},
    })
    return resp
  }

  async sessions(
    orgId: string,
    projectId: string,
    id: string
  ): Promise<TApiRes<TSandboxSession[]>> {
    const resp = await this.api.get<TSandboxSession[]>({
      path: `${this.#path(orgId, projectId)}/${id}/sessions`,
      queryKey: [...this.cache.detail(id), `sessions`],
    })
    resp.error && (await this._onError(resp.error, `Failed to load sessions`))
    return resp
  }

  async listInstances(
    orgId: string,
    projectId: string,
    id: string
  ): Promise<TApiRes<TSandboxInstancesResponse>> {
    const resp = await this.api.get<TSandboxInstancesResponse>({
      path: `${this.#path(orgId, projectId)}/${id}/instances`,
      queryKey: [...this.cache.detail(id), `instances`],
    })
    resp.error && (await this._onError(resp.error, `Failed to load instances`))
    return resp
  }

  async stop(
    orgId: string,
    projectId: string,
    id: string,
    instanceId: string,
    force?: boolean,
    stopAll?: boolean
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      data: { instanceId, force, stopAll },
      path: `${this.#path(orgId, projectId)}/${id}/stop`,
    })
    if (resp.error?.status !== 409) {
      resp.error && (await this._onError(resp.error, `Failed to stop sandbox`))
    }
    return resp
  }
}

export const sandboxApi = new SandboxApi()
