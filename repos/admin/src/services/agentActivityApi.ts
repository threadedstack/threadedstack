import type { TApiRes, TApiCacheKeys } from '@TAF/types'
import type { TActivityRecord, TAgentStatus } from '@TAF/types/agentActivity.types'

import { BaseApi } from '@TAF/services/api'

/**
 * Agent Activity API Service
 * Read-only telemetry reads for a single agent.
 *
 * Backend mount: /orgs/:orgId/projects/:projectId/agents/:agentId/activity
 *
 * Every read passes `staleTime: 0` because the default admin query cache is
 * stale-after-5-minutes: the 5s activity poll must hit the network each tick,
 * not replay a cached page. `status` unwraps the record envelope
 * `{ id, data, createdAt }` down to its `data`, which is where the liveness
 * fields live; the list reads return the records as-is for the timeline to
 * order by `data.at ?? createdAt`.
 */
export class AgentActivityApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`agentActivity`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #path(orgId: string, projectId: string, agentId: string) {
    return `/orgs/${orgId}/projects/${projectId}/agents/${agentId}/activity`
  }

  async status(
    orgId: string,
    projectId: string,
    agentId: string
  ): Promise<TApiRes<TAgentStatus>> {
    const resp = await this.api.get<TActivityRecord>({
      path: `${this.#path(orgId, projectId, agentId)}/status`,
      queryKey: [...this.cache.detail(agentId), `status`],
      staleTime: 0,
    })

    resp.error && (await this._onError(resp.error, `Failed to load agent status`))

    // The endpoint returns a record envelope { id, data, createdAt } (or null
    // when the agent has never run). The liveness fields the UI reads live on
    // the record's `data`, so unwrap one level; a never-run agent yields
    // `undefined` here, which the fetch action turns into the atom's `null`.
    return { ...resp, data: resp.data ? (resp.data.data as TAgentStatus) : undefined }
  }

  async turns(
    orgId: string,
    projectId: string,
    agentId: string,
    limit = 25
  ): Promise<TApiRes<TActivityRecord[]>> {
    const resp = await this.api.get<TActivityRecord[]>({
      data: { limit },
      path: `${this.#path(orgId, projectId, agentId)}/turns`,
      queryKey: [...this.cache.list(orgId, projectId, agentId), `turns`],
      staleTime: 0,
    })

    resp.error && (await this._onError(resp.error, `Failed to load agent turns`))

    return { ...resp, data: resp.data || [] }
  }

  async messages(
    orgId: string,
    projectId: string,
    agentId: string,
    limit = 25
  ): Promise<TApiRes<TActivityRecord[]>> {
    const resp = await this.api.get<TActivityRecord[]>({
      data: { limit },
      path: `${this.#path(orgId, projectId, agentId)}/messages`,
      queryKey: [...this.cache.list(orgId, projectId, agentId), `messages`],
      staleTime: 0,
    })

    resp.error && (await this._onError(resp.error, `Failed to load agent messages`))

    return { ...resp, data: resp.data || [] }
  }

  async memories(
    orgId: string,
    projectId: string,
    agentId: string,
    limit = 25
  ): Promise<TApiRes<TActivityRecord[]>> {
    const resp = await this.api.get<TActivityRecord[]>({
      data: { limit },
      path: `${this.#path(orgId, projectId, agentId)}/memories`,
      queryKey: [...this.cache.list(orgId, projectId, agentId), `memories`],
      staleTime: 0,
    })

    resp.error && (await this._onError(resp.error, `Failed to load agent memories`))

    return { ...resp, data: resp.data || [] }
  }
}

export const agentActivityApi = new AgentActivityApi()
