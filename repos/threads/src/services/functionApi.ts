import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { Function as FunctionModel } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

/**
 * Function API Service
 * Handles read-only Function listing for the threads SPA
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/functions
 */
export class FunctionApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`functions`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/functions`
  }

  /**
   * Get all functions for a project
   */
  async list(
    orgId: string,
    projectId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<FunctionModel[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<FunctionModel[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Functions list`))

    return {
      ...resp,
      data: resp?.data?.map?.((func) => new FunctionModel(func)) || [],
    }
  }
}

export const functionApi = new FunctionApi()
