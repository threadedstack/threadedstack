import type { TCollectionWithCount } from '@tdsk/domain'
import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { BaseApi } from '@TAF/services/api'

/** Collection row shape returned by create/update — no `recordCount` (that's a list-only aggregate). */
type TCollectionRow = Omit<TCollectionWithCount, `recordCount`>

/**
 * Collections API Service
 * Client for the Collections/Records primitive's collection-level CRUD endpoints.
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/collections
 * Note: get/update/delete are keyed by the collection's `name`, not its `id`
 * (see repos/backend/src/endpoints/collections/{getCollection,updateCollection,deleteCollection}.ts).
 */
export class CollectionsApi extends BaseApi {
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
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @returns List of all collections
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
   * Create a new collection
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param data - Collection data
   * @returns Created collection
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
   * Update an existing collection
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param name - Collection name (the current name, used to locate the collection)
   * @param data - Updated collection data
   * @returns Updated collection
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
   * Delete a collection
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param name - Collection name
   * @returns Success status
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

export const collectionsApi = new CollectionsApi()
