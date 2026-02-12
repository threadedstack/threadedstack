import type { TApiRes } from '@TAF/types'
import type { TQuickstartRequest, TQuickstartResponse } from '@tdsk/domain'

import { BaseApi } from '@TAF/services/api'

/**
 * Quickstart API Service
 * Handles the one-shot quickstart endpoint that creates
 * Provider + Secret + Project + Agent + Endpoint in a single transaction
 */
export class QuickstartApi extends BaseApi {
  /**
   * Create all resources via the quickstart endpoint
   * @param orgId - Organization ID
   * @param data - Quickstart request payload
   * @returns All 5 created resources
   */
  async create(
    orgId: string,
    data: TQuickstartRequest
  ): Promise<TApiRes<TQuickstartResponse>> {
    const resp = await this.api.post<TQuickstartResponse>({
      data,
      path: `/orgs/${orgId}/quickstart`,
    })

    resp.error && (await this._onError(resp.error, `Failed to create resources`))

    return resp
  }
}

// Export singleton instance
export const quickstartApi = new QuickstartApi()
