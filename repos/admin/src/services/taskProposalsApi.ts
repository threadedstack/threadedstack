import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { TaskProposal } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Task Proposals API Service
 * Handles all self-sensed task-proposal API operations (P4a).
 *
 * Proposals are org-scoped resources at /orgs/:orgId/task-proposals.
 * The server auto-promotes scanned proposals via the work cycle; this surface
 * is an optional async admin override (reject only — there is no approve).
 */
export class TaskProposalsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`task-proposals`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/task-proposals`
  }

  /**
   * Get all task proposals for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (status, agentId, etc.)
   * @returns List of all task proposals
   */
  async list(
    orgId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<TaskProposal[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<TaskProposal[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Task Proposals list`))

    return {
      ...resp,
      data: resp.data?.map((proposal) => new TaskProposal(proposal)) || [],
    }
  }

  /**
   * Get task proposal by ID
   * @param orgId - Organization ID
   * @param id - Task Proposal ID
   * @returns Task Proposal object
   */
  async get(orgId: string, id: string): Promise<TApiRes<TaskProposal>> {
    const resp = await this.api.get<TaskProposal>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Task Proposal`))

    return {
      ...resp,
      data: resp.data ? new TaskProposal(resp.data) : undefined,
    }
  }

  /**
   * Review a task proposal (async admin override — reject only, approve is a no-op)
   * @param orgId - Organization ID
   * @param id - Task Proposal ID
   * @param data - Review decision: { approve, reason? }
   * @returns Updated task proposal
   */
  async review(
    orgId: string,
    id: string,
    data: { approve: boolean; reason?: string }
  ): Promise<TApiRes<TaskProposal>> {
    const resp = await this.api.post<TaskProposal>({
      data,
      path: `${this.#path(orgId)}/${id}/review`,
    })

    resp.error && (await this._onError(resp.error, `Failed to review Task Proposal`))

    return {
      ...resp,
      data: resp.data ? new TaskProposal(resp.data) : undefined,
    }
  }
}

export const taskProposalsApi = new TaskProposalsApi()
