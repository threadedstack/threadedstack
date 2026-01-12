import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Project } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Projects API Service
 * Handles all Project-related API operations
 */
export class ProjectsApi extends BaseApi {
  private readonly path = `/projects`

  cache: TApiCacheKeys = {
    all: () => [this.path] as const,
    list: () => [...this.cache.all(), `list`] as const,
    listOrg: (orgId: string) => [...this.cache.list(), orgId] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  /**
   * Get all project
   * @param params - Optional query parameters (orgId, limit, offset, etc.)
   * @returns List of all projects
   */
  async list(data: Record<string, any> = {}): Promise<TApiRes<Record<string, Project>>> {
    const { queryKey, ...rest } = data

    const resp = await this.api.get<Project[]>({
      data: rest,
      path: this.path,
      queryKey: queryKey || this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Projects list`))

    return {
      ...resp,
      data: resp?.data?.reduce?.((acc, project) => {
        acc[project.id] = new Project(project)
        return acc
      }, {}),
    }
  }

  /**
   * Get project by ID
   * @param id - Project ID
   * @returns Project object
   */
  async get(id: string): Promise<TApiRes<Project>> {
    const resp = await this.api.get<Project>({
      path: `${this.path}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Project`))

    return {
      ...resp,
      data: new Project(resp.data),
    }
  }

  /**
   * Create new project
   * @param data - Project data
   * @returns Created project
   */
  async create(data: Partial<Project>): Promise<TApiRes<Project>> {
    const resp = await this.api.post<Project>({
      data,
      path: this.path,
    })

    resp.error && (await this._onError(resp.error, `Failed to create Project`))

    return {
      ...resp,
      data: new Project(resp.data),
    }
  }

  /**
   * Update existing project
   * @param id - Project ID
   * @param data - Updated project data
   * @returns Updated project
   */
  async update(id: string, data: Partial<Project>): Promise<TApiRes<Project>> {
    const resp = await this.api.put<Project>({
      data,
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Project`))

    return {
      ...resp,
      data: new Project(resp.data),
    }
  }

  /**
   * Delete project
   * @param id - Project ID
   * @returns Success status
   */
  async delete(id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Project`))

    return resp
  }

  /**
   * Get projects by org ID
   * @param orgId - Org ID
   * @returns List of projects for the org
   */
  async listByOrg(orgId: string): Promise<TApiRes<Record<string, Project>>> {
    return this.list({
      orgId,
      queryKey: this.cache.listOrg(orgId),
    })
  }
}

// Export singleton instance
export const projectsApi = new ProjectsApi()
