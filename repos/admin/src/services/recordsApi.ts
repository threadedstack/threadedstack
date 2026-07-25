import type { TRecordQuery } from '@tdsk/domain'
import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { BaseApi } from '@TAF/services/api'
import { Record as RecordModel } from '@tdsk/domain'

/**
 * Records API Service
 * Handles CRUD operations for records nested under a project-scoped Collection.
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/collections/:name/records
 */
export class RecordsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`records`] as const,
    list: (projectId: string, collectionName: string) =>
      [...this.cache.all(), projectId, collectionName, `list`] as const,
    detail: (projectId: string, collectionName: string, id: string) =>
      [...this.cache.all(), projectId, collectionName, `detail`, id] as const,
  }

  #path(orgId: string, projectId: string, collectionName: string) {
    return `/orgs/${orgId}/projects/${projectId}/collections/${collectionName}/records`
  }

  /**
   * Query a collection's records with the injection-safe query API.
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param collectionName - Collection name
   * @param query - Query filters, ordering, and pagination
   * @returns List of matching records
   */
  async query(
    orgId: string,
    projectId: string,
    collectionName: string,
    query: TRecordQuery
  ): Promise<TApiRes<RecordModel[]>> {
    const resp = await this.api.post<RecordModel[]>({
      data: query,
      path: `${this.#path(orgId, projectId, collectionName)}/query`,
    })

    resp.error && (await this._onError(resp.error, `Failed to query Records`))

    return {
      ...resp,
      data: resp.data?.map?.((record) => new RecordModel(record)) || [],
    }
  }

  /**
   * Get a record by ID
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param collectionName - Collection name
   * @param id - Record ID
   * @returns Record object
   */
  async get(
    orgId: string,
    projectId: string,
    collectionName: string,
    id: string
  ): Promise<TApiRes<RecordModel>> {
    const resp = await this.api.get<RecordModel>({
      path: `${this.#path(orgId, projectId, collectionName)}/${id}`,
      queryKey: this.cache.detail(projectId, collectionName, id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Record`))

    return {
      ...resp,
      data: resp.data ? new RecordModel(resp.data) : undefined,
    }
  }

  /**
   * Create or replace a record by ID
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param collectionName - Collection name
   * @param data - Record id (omit to create) and document data
   * @returns Upserted record
   */
  async upsert(
    orgId: string,
    projectId: string,
    collectionName: string,
    data: { id?: string; data: Record<string, any> }
  ): Promise<TApiRes<RecordModel>> {
    const resp = await this.api.post<RecordModel>({
      data,
      path: `${this.#path(orgId, projectId, collectionName)}/`,
    })

    resp.error && (await this._onError(resp.error, `Failed to save Record`))

    return {
      ...resp,
      data: resp.data ? new RecordModel(resp.data) : undefined,
    }
  }

  /**
   * Delete a record by ID
   * @param orgId - Organization ID
   * @param projectId - Project ID
   * @param collectionName - Collection name
   * @param id - Record ID
   * @returns Success status
   */
  async delete(
    orgId: string,
    projectId: string,
    collectionName: string,
    id: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId, collectionName)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Record`))

    return resp
  }
}

export const recordsApi = new RecordsApi()
