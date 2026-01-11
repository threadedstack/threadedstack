import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { User } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Users API Service
 * Handles all User-related API operations
 */
export class UsersApi extends BaseApi {
  private readonly path = `/users`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    listOrg: (orgId: string) => [...this.cache.all(), `list`, orgId] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    me: () => [`auth`, `me`] as const,
  }

  /**
   * Get all users
   * @param data - Optional query parameters (orgId, limit, offset, etc.)
   * @returns List of all users
   */
  async list(data?: Record<string, any>): Promise<TApiRes<User[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<User[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Users list`))

    return {
      ...resp,
      data: resp.data?.map((user) => new User(user)) || [],
    }
  }

  /**
   * Get user by ID
   * @param id - User ID
   * @returns User object
   */
  async get(id: string): Promise<TApiRes<User>> {
    const resp = await this.api.get<User>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load User`))

    return {
      ...resp,
      data: resp.data ? new User(resp.data) : undefined,
    }
  }

  /**
   * Create new user
   * @param data - User data
   * @returns Created user
   */
  async create(data: Partial<User>): Promise<TApiRes<User>> {
    const resp = await this.api.post<User>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create User`))

    return {
      ...resp,
      data: resp.data ? new User(resp.data) : undefined,
    }
  }

  /**
   * Update existing user
   * @param id - User ID
   * @param data - Updated user data
   * @returns Updated user
   */
  async update(id: string, data: Partial<User>): Promise<TApiRes<User>> {
    const resp = await this.api.put<User>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update User`))

    return {
      ...resp,
      data: resp.data ? new User(resp.data) : undefined,
    }
  }

  /**
   * Delete user
   * @param id - User ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete User`))

    return resp
  }

  /**
   * Get current authenticated user (from JWT)
   * @returns Current user object
   */
  async me(): Promise<TApiRes<User>> {
    const resp = await this.api.get<User>({
      path: `/auth/me`,
      queryKey: this.cache.me(),
    })

    resp.error && (await this._onError(resp.error, `Failed to get current user`))

    return {
      ...resp,
      data: resp.data ? new User(resp.data) : undefined,
    }
  }

  /**
   * Get users by org ID
   * @param orgId - Org ID
   * @returns List of users for the org
   */
  async listByOrg(orgId: string): Promise<TApiRes<User[]>> {
    return this.list({
      orgId,
      queryKey: this.cache.listOrg(orgId),
    })
  }

  /**
   * Invite user to org
   * @param orgId - Org ID
   * @param data - Invite data (email and roleType)
   * @returns Success status
   */
  async inviteToOrg(
    orgId: string,
    data: { email: string; roleType: string }
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      data,
      path: `/orgs/${orgId}/users/invite`,
    })

    resp.error && (await this._onError(resp.error, `Failed to invite user to org`))

    return resp
  }

  /**
   * Update user role in org
   * @param orgId - Org ID
   * @param roleId - Role ID
   * @param roleType - New role type
   * @returns Success status
   */
  async updateRole(
    orgId: string,
    roleId: string,
    roleType: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.put<{ success: boolean }>({
      data: { roleType },
      path: `/orgs/${orgId}/roles/${roleId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update user role`))

    return resp
  }

  /**
   * Remove user from org
   * @param orgId - Org ID
   * @param roleId - Role ID
   * @returns Success status
   */
  async removeFromOrg(
    orgId: string,
    roleId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `/orgs/${orgId}/roles/${roleId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to remove user from org`))

    return resp
  }
}

// Export singleton instance
export const usersApi = new UsersApi()
