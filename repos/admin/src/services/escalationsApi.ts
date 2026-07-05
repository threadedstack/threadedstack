import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Escalation } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Escalations API Service
 * Handles all escalation API operations (P4b).
 *
 * Escalations are org-scoped resources at /orgs/:orgId/escalations.
 * The steward opens escalations when it hits a need it cannot yet act on.
 * This surface provides async admin overrides: resolve (need was met) or
 * reject (decided not to act). Neither action blocks the steward.
 */
export class EscalationsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`escalations`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/escalations`
  }

  /**
   * Get all escalations for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (status, agentId, etc.)
   * @returns List of all escalations
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Escalation[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Escalation[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Escalations list`))

    return {
      ...resp,
      data: resp.data?.map((escalation) => new Escalation(escalation)) || [],
    }
  }

  /**
   * Get escalation by ID
   * @param orgId - Organization ID
   * @param id - Escalation ID
   * @returns Escalation object
   */
  async get(orgId: string, id: string): Promise<TApiRes<Escalation>> {
    const resp = await this.api.get<Escalation>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Escalation`))

    return {
      ...resp,
      data: resp.data ? new Escalation(resp.data) : undefined,
    }
  }

  /**
   * Resolve or reject an escalation (async admin override)
   * @param orgId - Organization ID
   * @param id - Escalation ID
   * @param data - Resolution: { status: 'resolved' | 'rejected', resolvedRef?, reason? }
   * @returns Updated escalation
   */
  async resolve(
    orgId: string,
    id: string,
    data: { status: 'resolved' | 'rejected'; resolvedRef?: string; reason?: string }
  ): Promise<TApiRes<Escalation>> {
    const resp = await this.api.post<Escalation>({
      data,
      path: `${this.#path(orgId)}/${id}/resolve`,
    })

    resp.error && (await this._onError(resp.error, `Failed to resolve Escalation`))

    return {
      ...resp,
      data: resp.data ? new Escalation(resp.data) : undefined,
    }
  }
}

export const escalationsApi = new EscalationsApi()
