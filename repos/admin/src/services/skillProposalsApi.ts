import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { SkillProposal } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Skill Proposals API Service
 * Handles all self-authored skill-proposal API operations (P3b).
 *
 * Proposals are org-scoped resources at /orgs/:orgId/skill-proposals.
 * The server auto-promotes passing proposals; this surface is the human veto.
 */
export class SkillProposalsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`skill-proposals`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/skill-proposals`
  }

  /**
   * Get all skill proposals for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (status, agentId, etc.)
   * @returns List of all skill proposals
   */
  async list(
    orgId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<SkillProposal[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<SkillProposal[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Skill Proposals list`))

    return {
      ...resp,
      data: resp.data?.map((proposal) => new SkillProposal(proposal)) || [],
    }
  }

  /**
   * Get skill proposal by ID
   * @param orgId - Organization ID
   * @param id - Skill Proposal ID
   * @returns Skill Proposal object
   */
  async get(orgId: string, id: string): Promise<TApiRes<SkillProposal>> {
    const resp = await this.api.get<SkillProposal>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Skill Proposal`))

    return {
      ...resp,
      data: resp.data ? new SkillProposal(resp.data) : undefined,
    }
  }

  /**
   * Review a skill proposal (human veto — approve or reject)
   * @param orgId - Organization ID
   * @param id - Skill Proposal ID
   * @param data - Review decision: { approve, reason? }
   * @returns Updated skill proposal
   */
  async review(
    orgId: string,
    id: string,
    data: { approve: boolean; reason?: string }
  ): Promise<TApiRes<SkillProposal>> {
    const resp = await this.api.post<SkillProposal>({
      data,
      path: `${this.#path(orgId)}/${id}/review`,
    })

    resp.error && (await this._onError(resp.error, `Failed to review Skill Proposal`))

    return {
      ...resp,
      data: resp.data ? new SkillProposal(resp.data) : undefined,
    }
  }
}

export const skillProposalsApi = new SkillProposalsApi()
