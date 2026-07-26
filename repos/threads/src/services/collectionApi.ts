import type { TCollectionWithCount } from '@tdsk/domain'
import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { BaseApi } from '@TTH/services/api'

/**
 * Collections API Service
 * Read-only client for the Collections/Records primitive's collection list.
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/collections
 */
export class CollectionApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`collections`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/collections`
  }

  /**
   * Get all collections for a project, each with its live record count.
   */
  async list(orgId: string, projectId: string): Promise<TApiRes<TCollectionWithCount[]>> {
    const resp = await this.api.get<TCollectionWithCount[]>({
      path: this.#path(orgId, projectId),
      queryKey: this.cache.list(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Collections list`))

    return {
      ...resp,
      data: resp.data || [],
    }
  }
}

export const collectionApi = new CollectionApi()
