import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Skill } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Skills API Service
 * Handles all Skill-related API operations
 *
 * Skills are org-scoped resources at /orgs/:orgId/skills
 */
export class SkillsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`skills`] as const,
    list: () => [...this.cache.all(), `list`] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/skills`
  }

  /**
   * Get all skills for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all skills
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Skill[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Skill[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Skills list`))

    return {
      ...resp,
      data: resp.data?.map((skill) => new Skill(skill)) || [],
    }
  }

  /**
   * Get skill by ID
   * @param orgId - Organization ID
   * @param id - Skill ID
   * @returns Skill object
   */
  async get(orgId: string, id: string): Promise<TApiRes<Skill>> {
    const resp = await this.api.get<Skill>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Skill`))

    return {
      ...resp,
      data: resp.data ? new Skill(resp.data) : undefined,
    }
  }

  /**
   * Create new skill
   * @param orgId - Organization ID
   * @param data - Skill data
   * @returns Created skill
   */
  async create(orgId: string, data: Partial<Skill>): Promise<TApiRes<Skill>> {
    const resp = await this.api.post<Skill>({
      data,
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Skill`))

    return {
      ...resp,
      data: resp.data ? new Skill(resp.data) : undefined,
    }
  }

  /**
   * Update existing skill
   * @param orgId - Organization ID
   * @param id - Skill ID
   * @param data - Updated skill data
   * @returns Updated skill
   */
  async update(orgId: string, id: string, data: Partial<Skill>): Promise<TApiRes<Skill>> {
    const resp = await this.api.put<Skill>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Skill`))

    return {
      ...resp,
      data: resp.data ? new Skill(resp.data) : undefined,
    }
  }

  /**
   * Delete skill
   * @param orgId - Organization ID
   * @param id - Skill ID
   * @returns Success status
   */
  async delete(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Skill`))

    return resp
  }

  /**
   * Attach a skill to an agent
   * @param orgId - Organization ID
   * @param skillId - Skill ID
   * @param agentId - Agent ID to attach the skill to
   * @returns Success status
   */
  async attach(
    orgId: string,
    skillId: string,
    agentId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      data: { agentId },
      path: `${this.#path(orgId)}/${skillId}/attach`,
    })

    resp.error && (await this._onError(resp.error, `Failed to attach Skill to Agent`))

    return resp
  }

  /**
   * Detach a skill from an agent
   * @param orgId - Organization ID
   * @param skillId - Skill ID
   * @param agentId - Agent ID to detach the skill from
   * @returns Success status
   */
  async detach(
    orgId: string,
    skillId: string,
    agentId: string
  ): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      data: { agentId },
      path: `${this.#path(orgId)}/${skillId}/detach`,
    })

    resp.error && (await this._onError(resp.error, `Failed to detach Skill from Agent`))

    return resp
  }
}

export const skillsApi = new SkillsApi()
