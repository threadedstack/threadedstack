import type { TApiRes, TApiCacheKeys } from '@TAF/types'

import { Schedule, ScheduleRun } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

/**
 * Schedules API Service
 * Handles all Schedule-related API operations
 *
 * Schedules belong to an organization and reference an agent.
 * Backend mount: /orgs/:orgId/schedules
 */
export class SchedulesApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`schedules`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string) {
    return `/orgs/${orgId}/schedules`
  }

  /**
   * Get all schedules for an organization
   * @param orgId - Organization ID
   * @param data - Optional query parameters (limit, offset, etc.)
   * @returns List of all schedules
   */
  async list(orgId: string, data?: Record<string, any>): Promise<TApiRes<Schedule[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Schedule[]>({
      data: rest,
      path: this.#path(orgId),
      queryKey: queryKey || this.cache.list(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Schedules list`))

    return {
      ...resp,
      data: resp.data?.map((s) => new Schedule(s)) || [],
    }
  }

  /**
   * Get schedule by ID
   * @param orgId - Organization ID
   * @param id - Schedule ID
   * @returns Schedule object
   */
  async get(orgId: string, id: string): Promise<TApiRes<Schedule>> {
    const resp = await this.api.get<Schedule>({
      path: `${this.#path(orgId)}/${id}`,
      queryKey: this.cache.detail(id),
    })

    resp.error && (await this._onError(resp.error, `Failed to load Schedule`))

    return {
      ...resp,
      data: resp.data ? new Schedule(resp.data) : undefined,
    }
  }

  /**
   * Create new schedule
   * @param orgId - Organization ID
   * @param data - Schedule data
   * @returns Created schedule
   */
  async create(orgId: string, data: Partial<Schedule>): Promise<TApiRes<Schedule>> {
    const resp = await this.api.post<Schedule>({
      data,
      path: this.#path(orgId),
    })

    resp.error && (await this._onError(resp.error, `Failed to create Schedule`))

    return {
      ...resp,
      data: resp.data ? new Schedule(resp.data) : undefined,
    }
  }

  /**
   * Update existing schedule
   * @param orgId - Organization ID
   * @param id - Schedule ID
   * @param data - Updated schedule data
   * @returns Updated schedule
   */
  async update(
    orgId: string,
    id: string,
    data: Partial<Schedule>
  ): Promise<TApiRes<Schedule>> {
    const resp = await this.api.put<Schedule>({
      data,
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update Schedule`))

    return {
      ...resp,
      data: resp.data ? new Schedule(resp.data) : undefined,
    }
  }

  /**
   * Delete schedule
   * @param orgId - Organization ID
   * @param id - Schedule ID
   * @returns Success status
   */
  async delete(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.delete<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to delete Schedule`))

    return resp
  }

  /**
   * Trigger a schedule to run immediately
   * @param orgId - Organization ID
   * @param id - Schedule ID
   * @returns Triggered schedule result
   */
  async trigger(orgId: string, id: string): Promise<TApiRes<{ success: boolean }>> {
    const resp = await this.api.post<{ success: boolean }>({
      path: `${this.#path(orgId)}/${id}/trigger`,
    })

    resp.error && (await this._onError(resp.error, `Failed to trigger Schedule`))

    return resp
  }

  async listRuns(
    orgId: string,
    scheduleId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TApiRes<ScheduleRun[]>> {
    const resp = await this.api.get<ScheduleRun[]>({
      data: opts,
      path: `${this.#path(orgId)}/${scheduleId}/runs`,
      queryKey: [...this.cache.detail(scheduleId), `runs`],
    })

    resp.error && (await this._onError(resp.error, `Failed to load Schedule runs`))

    return {
      ...resp,
      data: resp.data?.map((r) => new ScheduleRun(r)) || [],
    }
  }

  async getRun(
    orgId: string,
    scheduleId: string,
    runId: string
  ): Promise<TApiRes<ScheduleRun>> {
    const resp = await this.api.get<ScheduleRun>({
      path: `${this.#path(orgId)}/${scheduleId}/runs/${runId}`,
      queryKey: [...this.cache.detail(scheduleId), `runs`, runId],
    })

    resp.error && (await this._onError(resp.error, `Failed to load Schedule run`))

    return {
      ...resp,
      data: resp.data ? new ScheduleRun(resp.data) : undefined,
    }
  }
}

export const schedulesApi = new SchedulesApi()
