import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Agent } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Agents API Service
 * Handles all Agent-related API operations
 */
export class AgentsApi extends BaseApi {
  private readonly path = `/agents`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all agents
   * @param data - Optional query parameters (projectId, limit, offset, etc.)
   * @returns List of all agents
   */
  async list(data?: Record<string, any>): Promise<TApiRes<Agent[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Agent[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Agents list`))

    return {
      ...resp,
      data: resp.data?.map((agent) => new Agent(agent)) || [],
    }
  }

  /**
   * Get agent by ID
   * @param id - Agent ID
   * @returns Agent object
   */
  async get(id: string): Promise<TApiRes<Agent>> {
    const resp = await this.api.get<Agent>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Agent`))

    return {
      ...resp,
      data: resp.data ? new Agent(resp.data) : undefined,
    }
  }

  /**
   * Create new agent
   * @param data - Agent data
   * @returns Created agent
   */
  async create(data: Partial<Agent>): Promise<TApiRes<Agent>> {
    const resp = await this.api.post<Agent>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Agent`))

    return {
      ...resp,
      data: resp.data ? new Agent(resp.data) : undefined,
    }
  }

  /**
   * Update existing agent
   * @param id - Agent ID
   * @param data - Updated agent data
   * @returns Updated agent
   */
  async update(id: string, data: Partial<Agent>): Promise<TApiRes<Agent>> {
    const resp = await this.api.put<Agent>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Agent`))

    return {
      ...resp,
      data: resp.data ? new Agent(resp.data) : undefined,
    }
  }

  /**
   * Delete agent
   * @param id - Agent ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Agent`))

    return resp
  }
}

// Export singleton instance
export const agentsApi = new AgentsApi()
