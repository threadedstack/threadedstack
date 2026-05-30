import type { TApiRes, TApiCacheKeys } from '@TTH/types'

import { Organization } from '@tdsk/domain'
import { BaseApi } from '@TTH/services/api'

export class OrgsApi extends BaseApi {
  #path = `/orgs`

  cache: TApiCacheKeys = {
    all: () => [`orgs`] as const,
    list: () => [...this.cache.all(), `list`] as const,
  }

  async list(): Promise<TApiRes<Organization[]>> {
    const resp = await this.api.get<Organization[]>({
      path: this.#path,
      queryKey: this.cache.list(),
    })

    resp.error && (await this._onError(resp.error, `Failed to load organizations`))

    return {
      ...resp,
      data: resp?.data?.map?.((o) => new Organization(o)) || [],
    }
  }

  async get(id: string): Promise<TApiRes<Organization>> {
    const resp = await this.api.get<Organization>({
      path: `${this.#path}/${id}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to load organization ${id}`))

    return {
      ...resp,
      data: resp.data ? new Organization(resp.data) : undefined,
    }
  }
}

export const orgsApi = new OrgsApi()
