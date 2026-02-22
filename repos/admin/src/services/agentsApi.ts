import type { TStreamEvent } from '@tdsk/domain'
import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type { TAgentProjectConfig } from '@tdsk/domain'
import { Agent } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'
import { apiUrl } from '@TAF/utils/api/apiUrl'

/**
 * Agents API Service
 * Handles all Agent-related API operations
 *
 * Agents are "exclusive arc" resources — they belong to either an org OR a project.
 * The backend has two mount points:
 *   Org-scoped:     /orgs/:orgId/agents
 *   Project-scoped: /orgs/:orgId/projects/:projectId/agents
 */
export class AgentsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`agents`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId?: string) {
    return projectId
      ? `/orgs/${orgId}/projects/${projectId}/agents`
      : `/orgs/${orgId}/agents`
  }

  #configPath(orgId: string, projectId: string, agentId: string) {
    return `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/config`
  }

  /**
   * Get all agents
   * @param orgId - Organization ID
   * @param projectId - Optional Project ID (for project-scoped agents)
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all agents
   */
  async list(
    orgId: string,
    projectId?: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Agent[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Agent[]>({
      data: rest,
      path: this.#path(orgId, projectId),
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
   * @param orgId - Organization ID
   * @param id - Agent ID
   * @param projectId - Optional Project ID (for project-scoped agents)
   * @returns Agent object
   */
  async get(orgId: string, id: string, projectId?: string): Promise<TApiRes<Agent>> {
    const resp = await this.api.get<Agent>({
      path: `${this.#path(orgId, projectId)}/${id}`,
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
   * @param orgId - Organization ID
   * @param data - Agent data
   * @param projectId - Optional Project ID (for project-scoped agents)
   * @returns Created agent
   */
  async create(
    orgId: string,
    data: Partial<Agent>,
    projectId?: string
  ): Promise<TApiRes<Agent>> {
    const resp = await this.api.post<Agent>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Agent`))

    return {
      ...resp,
      data: resp.data ? new Agent(resp.data) : undefined,
    }
  }

  /**
   * Update existing agent
   * @param orgId - Organization ID
   * @param id - Agent ID
   * @param data - Updated agent data
   * @param projectId - Optional Project ID (for project-scoped agents)
   * @returns Updated agent
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Agent>,
    projectId?: string
  ): Promise<TApiRes<Agent>> {
    const resp = await this.api.put<Agent>({
      data,
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Agent`))

    return {
      ...resp,
      data: resp.data ? new Agent(resp.data) : undefined,
    }
  }

  /**
   * Delete agent
   * @param orgId - Organization ID
   * @param id - Agent ID
   * @param projectId - Optional Project ID (for project-scoped agents)
   * @returns Success status
   */
  async delete(
    orgId: string,
    id: string,
    projectId?: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId, projectId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Agent`))

    return resp
  }

  /**
   * Get project-level config overrides for an agent
   */
  async getConfig(
    orgId: string,
    projectId: string,
    agentId: string
  ): Promise<TApiRes<TAgentProjectConfig>> {
    const resp = await this.api.get<TAgentProjectConfig>({
      path: this.#configPath(orgId, projectId, agentId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load agent config`))

    return resp
  }

  /**
   * Create or update project-level config overrides for an agent
   */
  async upsertConfig(
    orgId: string,
    projectId: string,
    agentId: string,
    data: Partial<TAgentProjectConfig>
  ): Promise<TApiRes<TAgentProjectConfig>> {
    const resp = await this.api.put<TAgentProjectConfig>({
      data,
      path: this.#configPath(orgId, projectId, agentId),
    })

    resp.error && (await this._onError(resp.error, `Failed to save agent config`))

    return resp
  }

  /**
   * Reset all project-level config overrides for an agent
   */
  async deleteConfig(
    orgId: string,
    projectId: string,
    agentId: string
  ): Promise<TApiRes<TAgentProjectConfig>> {
    const resp = await this.api.delete<TAgentProjectConfig>({
      path: this.#configPath(orgId, projectId, agentId),
    })

    resp.error && (await this._onError(resp.error, `Failed to reset agent config`))

    return resp
  }

  /**
   * Run an agent with SSE streaming
   * Returns an object with the Response for reading SSE events
   */
  async run(
    orgId: string,
    agentId: string,
    prompt: string,
    threadId?: string
  ): Promise<{ response?: Response; error?: Error }> {
    try {
      const base = apiUrl({})
      const url = `${base.replace(/\/$/, ``)}/_/orgs/${orgId}/agents/${agentId}/run`
      const headers = { ...this.api.options.headers }

      const res = await fetch(url, {
        method: `POST`,
        headers,
        body: JSON.stringify({ prompt, threadId }),
      })

      if (!res.ok) {
        const text = await res.text()
        return { error: new Error(text || `Agent run failed: ${res.status}`) }
      }

      return { response: res }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }
}

export const agentsApi = new AgentsApi()
