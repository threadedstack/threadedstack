import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Organization } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Org member data structure
 */
export type TOrgMemberData = {
  userId: string
  roleType?: string
}

/**
 * Orgs API Service
 * Handles all Org-related API operations
 */
export class OrgsApi extends BaseApi {
  private readonly path = `/orgs`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    members: (orgId: string) => [...this.cache.all(), orgId, `members`] as const,
  }

  /**
   * Get all orgs
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all orgs
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Record<string, Organization>>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Organization[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Orgs list`))

    return {
      ...resp,
      data:
        resp?.data?.reduce?.((acc, org) => {
          acc[org.id] = new Organization(org)
          return acc
        }, {}) || {},
    }
  }

  /**
   * Get org by ID
   * @param id - Org ID
   * @returns Org object
   */
  async get(id: string): Promise<TApiRes<Organization>> {
    const resp = await this.api.get<Organization>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Org`))

    return {
      ...resp,
      data: resp.data ? new Organization(resp.data) : undefined,
    }
  }

  /**
   * Create new org
   * @param data - Org data
   * @returns Created org
   */
  async create(data: Partial<Organization>): Promise<TApiRes<Organization>> {
    const resp = await this.api.post<Organization>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Org`))

    return {
      ...resp,
      data: resp.data ? new Organization(resp.data) : undefined,
    }
  }

  /**
   * Update existing org
   * @param id - Org ID
   * @param data - Updated org data
   * @returns Updated org
   */
  async update(id: string, data: Partial<Organization>): Promise<TApiRes<Organization>> {
    const resp = await this.api.put<Organization>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Org`))

    return {
      ...resp,
      data: resp.data ? new Organization(resp.data) : undefined,
    }
  }

  /**
   * Delete org
   * @param id - Org ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Org`))

    return resp
  }

  /**
   * Add member to org
   * @param orgId - Org ID
   * @param memberData - Member data (userId, roleType)
   * @returns Success status
   */
  async addMember(
    orgId: string,
    memberData: TOrgMemberData
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      data: memberData,
      path: `${this.path}/${orgId}/members`,
    })

    resp.error && (await this._onError(resp.error, `Failed to add org member`))

    return resp
  }

  /**
   * Remove member from org
   * @param orgId - Org ID
   * @param userId - User ID to remove
   * @returns Success status
   */
  async removeMember(
    orgId: string,
    userId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${orgId}/members/${userId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to remove org member`))

    return resp
  }
}

// Export singleton instance
export const orgsApi = new OrgsApi()
