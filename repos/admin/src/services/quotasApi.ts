import type {
  TApiRes,
  TQuotaData,
  TLimitsData,
  TApiCacheKeys,
  TCheckQuotaData,
  TQuotaCheckResult,
} from '@TAF/types'

import { BaseApi } from '@TAF/services/api'

/**
 * Quotas API Service
 * Handles all quota-related API operations
 */
export class QuotasApi extends BaseApi {
  #path(orgId: string) {
    return `/orgs/${orgId}/quotas`
  }

  cache: TApiCacheKeys = {
    all: () => [`/quotas`] as const,
    usage: (orgId: string) => [...this.cache.all(), `usage`, orgId] as const,
    limits: (orgId: string) => [...this.cache.all(), `limits`, orgId] as const,
  }

  /**
   * Get quota usage for an organization
   * @param params - Query parameters { orgId }
   * @returns Quota usage data
   */
  async get(params: { orgId: string }): Promise<TApiRes<TQuotaData>> {
    const { orgId } = params

    const resp = await this.api.get<TQuotaData>({
      path: this.#path(orgId),
      queryKey: this.cache.usage(orgId),
      staleTime: 30 * 1000, // Cache usage for 30 seconds
    })

    resp.error && (await this._onError(resp.error, `Failed to load quota usage`))

    return resp
  }

  /**
   * Get quota limits for an organization (from plan)
   * @param params - Query parameters { orgId }
   * @returns Quota limits data
   */
  async limits(params: { orgId: string }): Promise<TApiRes<TLimitsData>> {
    const { orgId } = params

    const resp = await this.api.get<TLimitsData>({
      path: `${this.#path(orgId)}/limits`,
      queryKey: this.cache.limits(orgId),
      staleTime: 60 * 1000, // Cache limits for 60 seconds
    })

    resp.error && (await this._onError(resp.error, `Failed to load quota limits`))

    return resp
  }

  /**
   * Check if a quota operation is allowed
   * @param data - Check quota data { orgId, resource, amount }
   * @returns Quota check result
   */
  async check(data: TCheckQuotaData): Promise<TApiRes<TQuotaCheckResult>> {
    const resp = await this.api.post<TQuotaCheckResult>({
      data,
      path: `${this.#path(data.orgId)}/check`,
    })

    resp.error && (await this._onError(resp.error, `Failed to check quota`))

    return resp
  }
}

// Export singleton instance
export const quotasApi = new QuotasApi()
