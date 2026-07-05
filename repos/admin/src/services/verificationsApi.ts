import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Verification } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Verifications API Service
 * Read-only observability for post-merge safety checks (P4c).
 *
 * Verifications are org-scoped resources at /orgs/:orgId/verifications.
 * After a steward PR merges and deploys, the verify cycle checks the declared
 * success probe against prod. On regression it automatically opens a revert PR
 * and files a target:app escalation. This service is read-only — no resolve or
 * reject action exists here; remediation is fully automatic.
 */
export class VerificationsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`verifications`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/verifications`
  }

  /**
   * Get all verifications for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (status, agentId, etc.)
   * @returns List of all verifications
   */
  async list(
    orgId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Verification[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Verification[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Verifications list`))

    return {
      ...resp,
      data: resp.data?.map((verification) => new Verification(verification)) || [],
    }
  }

  /**
   * Get verification by ID
   * @param orgId - Organization ID
   * @param id - Verification ID
   * @returns Verification object
   */
  async get(orgId: string, id: string): Promise<TApiRes<Verification>> {
    const resp = await this.api.get<Verification>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Verification`))

    return {
      ...resp,
      data: resp.data ? new Verification(resp.data) : undefined,
    }
  }
}

export const verificationsApi = new VerificationsApi()
