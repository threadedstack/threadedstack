import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { OpsAction } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Ops Actions API Service (P4d).
 *
 * Ops actions are org-scoped resources at /orgs/:orgId/ops-actions.
 * READ tier rows (podStatus/podLogs/deployState/quotaUsage) are informational.
 * WRITE tier rows (triggerRedeploy/restartDeployment/applySandboxConfig) flow through
 * scanner → dry-run + rollback captured → adversary review → execute.
 * The override endpoint is an OPTIONAL async human safety net — never on the critical path.
 */
export class OpsActionsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`opsActions`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/ops-actions`
  }

  /**
   * Get all ops actions for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (status, agentId, etc.)
   * @returns List of all ops actions
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<OpsAction[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<OpsAction[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Ops Actions list`))

    return {
      ...resp,
      data: resp.data?.map((action) => new OpsAction(action)) || [],
    }
  }

  /**
   * Get ops action by ID
   * @param orgId - Organization ID
   * @param id - Ops Action ID
   * @returns OpsAction object
   */
  async get(orgId: string, id: string): Promise<TApiRes<OpsAction>> {
    const resp = await this.api.get<OpsAction>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Ops Action`))

    return {
      ...resp,
      data: resp.data ? new OpsAction(resp.data) : undefined,
    }
  }

  /**
   * Async override: approve or reject a dryRun row, or revert an executed row.
   * @param orgId - Organization ID
   * @param id - Ops Action ID
   * @param data - { approve: boolean, reason?: string }
   * @returns Updated ops action or revert result
   */
  async override(
    orgId: string,
    id: string,
    data: { approve: boolean; reason?: string }
  ): Promise<TApiRes<OpsAction>> {
    const resp = await this.api.post<OpsAction>({
      data,
      path: `${this.#path(orgId)}/${id}/override`,
    })

    resp.error && (await this._onError(resp.error, `Failed to override Ops Action`))

    return {
      ...resp,
      data: resp.data ? new OpsAction(resp.data) : undefined,
    }
  }
}

export const opsActionsApi = new OpsActionsApi()
