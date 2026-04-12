import type { TApiRes, TApiCacheKeys } from '@TTH/types'
import type { Message } from '@tdsk/domain'
import { Thread } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

export class ThreadsApi extends BaseApi {
  cache: TApiCacheKeys = {
    all: () => [`threads`] as const,
    list: (...scope: string[]) => [...this.cache.all(), `list`, ...scope] as const,
    detail: (id: string) => [...this.cache.all(), `detail`, id] as const,
  }

  #sandboxThreadsPath(orgId: string, sandboxId: string) {
    return `/orgs/${orgId}/sandboxes/${sandboxId}/threads`
  }

  async listBySandbox(
    orgId: string,
    sandboxId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Thread[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Thread[]>({
      data: rest,
      path: this.#sandboxThreadsPath(orgId, sandboxId),
      queryKey: queryKey || this.cache.list(sandboxId),
    })

    resp.error && (await this._onError(resp.error, `Failed to load threads`))

    return {
      ...resp,
      data: resp.data?.map((thread) => new Thread(thread)) || [],
    }
  }

  async messages(
    orgId: string,
    sandboxId: string,
    threadId: string,
    data?: Record<string, any>
  ): Promise<TApiRes<Message[]>> {
    const { queryKey, ...rest } = data || {}

    const resp = await this.api.get<Message[]>({
      data: rest,
      path: `${this.#sandboxThreadsPath(orgId, sandboxId)}/${threadId}/messages`,
      queryKey: queryKey || [`threads`, `messages`, threadId],
    })

    resp.error && (await this._onError(resp.error, `Failed to load messages`))

    return resp
  }
}

export const threadsApi = new ThreadsApi()
