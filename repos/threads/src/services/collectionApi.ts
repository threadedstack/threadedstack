import type { TCollectionWithCount } from '@tdsk/domain'
import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { BaseApi } from '@TTH/services/api'

/** Collection row shape returned by create/update — no `recordCount` (that's a list-only aggregate). */
type TCollectionRow = Omit<TCollectionWithCount, `recordCount`>

/**
 * Collections API Service
 * Client for the Collections/Records primitive's collection-level CRUD endpoints.
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/collections
 * Note: update/delete are keyed by the collection's `name`, not its `id`.
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

  /**
   * Create a new collection.
   */
  async create(
    orgId: string,
    projectId: string,
    data: Partial<TCollectionWithCount>
  ): Promise<TApiRes<TCollectionRow>> {
    const resp = await this.api.post<TCollectionRow>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Collection`))

    return resp
  }

  /**
   * Update an existing collection, located by its current name.
   */
  async update(
    orgId: string,
    projectId: string,
    name: string,
    data: Partial<TCollectionWithCount>
  ): Promise<TApiRes<TCollectionRow>> {
    const resp = await this.api.put<TCollectionRow>({
      data,
      path: `${this.#path(orgId, projectId)}/${name}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Collection`))

    return resp
  }

  /**
   * Delete a collection by name.
   */
  async delete(
    orgId: string,
    projectId: string,
    name: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId)}/${name}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Collection`))

    return resp
  }
}

export const collectionApi = new CollectionApi()
