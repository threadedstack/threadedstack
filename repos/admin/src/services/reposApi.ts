import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Repo } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Repos API Service
 * Handles all Repository-related API operations
 */
export class ReposApi extends BaseApi {
  private readonly path = `/repos`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    listTeam: (teamId: string) => [...this.cache.list(), teamId] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all repositories
   * @param params - Optional query parameters (teamId, limit, offset, etc.)
   * @returns List of all repos
   */
  async list(data: Record<string, any> = {}): Promise<TApiRes<Record<string, Repo>>> {
    const { queryKey, ...rest } = data

    const resp = await this.api.get<Repo[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Repos list`))

    return {
      ...resp,
      data: resp?.data?.reduce?.((acc, repo) => {
        acc[repo.id] = new Repo(repo)
        return acc
      }, {}),
    }
  }

  /**
   * Get repository by ID
   * @param id - Repository ID
   * @returns Repo object
   */
  async get(id: string): Promise<TApiRes<Repo>> {
    const resp = await this.api.get<Repo>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Repo`))

    return {
      ...resp,
      data: new Repo(resp.data),
    }
  }

  /**
   * Create new repository
   * @param data - Repository data
   * @returns Created repo
   */
  async create(data: Partial<Repo>): Promise<TApiRes<Repo>> {
    const resp = await this.api.post<Repo>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Repo`))

    return {
      ...resp,
      data: new Repo(resp.data),
    }
  }

  /**
   * Update existing repository
   * @param id - Repository ID
   * @param data - Updated repo data
   * @returns Updated repo
   */
  async update(id: string, data: Partial<Repo>): Promise<TApiRes<Repo>> {
    const resp = await this.api.put<Repo>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Repo`))

    return {
      ...resp,
      data: new Repo(resp.data),
    }
  }

  /**
   * Delete repository
   * @param id - Repository ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Repo`))

    return resp
  }

  /**
   * Get repositories by team ID
   * @param teamId - Team ID
   * @returns List of repos for the team
   */
  async listByTeam(teamId: string): Promise<TApiRes<Record<string, Repo>>> {
    return this.list({
      teamId,
      queryKey: this.cache.listTeam(teamId),
    })
  }
}

// Export singleton instance
export const reposApi = new ReposApi()
