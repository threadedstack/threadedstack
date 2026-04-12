import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { Project } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

export class ProjectsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`projects`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/projects`
  }

  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Project[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Project[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load projects`))

    return {
      ...resp,
      data: resp?.data?.map?.((p) => new Project(p)) || [],
    }
  }
}

export const projectsApi = new ProjectsApi()
