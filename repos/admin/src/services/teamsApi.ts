import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Team } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Team member data structure
 */
export type TTeamMemberData = {
  userId: string
  role?: string
}

/**
 * Teams API Service
 * Handles all Team-related API operations
 */
export class TeamsApi extends BaseApi {
  private readonly path = `/teams`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
    members: (teamId: string) => [...this.cache.all(), teamId, `members`] as const,
  }

  /**
   * Get all teams
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all teams
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Team[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Team[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Teams list`))

    return {
      ...resp,
      data: resp?.data?.map?.((team) => new Team(team)) || [],
    }
  }

  /**
   * Get team by ID
   * @param id - Team ID
   * @returns Team object
   */
  async get(id: string): Promise<TApiRes<Team>> {
    const resp = await this.api.get<Team>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Team`))

    return {
      ...resp,
      data: resp.data ? new Team(resp.data) : undefined,
    }
  }

  /**
   * Create new team
   * @param data - Team data
   * @returns Created team
   */
  async create(data: Partial<Team>): Promise<TApiRes<Team>> {
    const resp = await this.api.post<Team>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Team`))

    return {
      ...resp,
      data: resp.data ? new Team(resp.data) : undefined,
    }
  }

  /**
   * Update existing team
   * @param id - Team ID
   * @param data - Updated team data
   * @returns Updated team
   */
  async update(id: string, data: Partial<Team>): Promise<TApiRes<Team>> {
    const resp = await this.api.put<Team>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Team`))

    return {
      ...resp,
      data: resp.data ? new Team(resp.data) : undefined,
    }
  }

  /**
   * Delete team
   * @param id - Team ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Team`))

    return resp
  }

  /**
   * Add member to team
   * @param teamId - Team ID
   * @param memberData - Member data (userId, role)
   * @returns Success status
   */
  async addMember(
    teamId: string,
    memberData: TTeamMemberData
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      data: memberData,
      path: `${this.path}/${teamId}/members`,
    })

    resp.error && (await this._onError(resp.error, `Failed to add team member`))

    return resp
  }

  /**
   * Remove member from team
   * @param teamId - Team ID
   * @param userId - User ID to remove
   * @returns Success status
   */
  async removeMember(
    teamId: string,
    userId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${teamId}/members/${userId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to remove team member`))

    return resp
  }
}

// Export singleton instance
export const teamsApi = new TeamsApi()
