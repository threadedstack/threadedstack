import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { Schedule } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

/**
 * Schedule API Service
 * Handles read-only Schedule listing for the threads SPA
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/schedules
 */
export class ScheduleApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`schedules`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/schedules`
  }

  /**
   * Get all schedules for a project
   */
  async list(
    orgId: string,
    projectId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Schedule[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Schedule[]>({
      data: rest,
      path: this.#path(orgId, projectId),
      queryKey: queryKey || this.cache.list(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Schedules list`))

    return {
      ...resp,
      data: resp?.data?.map?.((s) => new Schedule(s)) || [],
    }
  }
}

export const scheduleApi = new ScheduleApi()
