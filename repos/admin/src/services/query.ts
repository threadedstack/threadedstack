import type { TQueryKey, TReadOnlyQueryKey } from '@TAF/types'

import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { QueryClient, queryOptions } from '@tanstack/react-query'
import { DefCacheStaleTime, DefCacheGarbageColTime } from '@TAF/constants/query'

type TFetchQuery = QueryClient[`fetchQuery`]

export type TQueryService = {}

export class QueryService {
  client: QueryClient
  fetch: TFetchQuery

  constructor() {
    this.#create()
  }

  options: typeof queryOptions = (opts) => queryOptions(cleanColl(opts))

  reset = () => {
    this.client?.clear()
    this.fetch = undefined
    this.client = undefined
    this.#create()
  }

  #create = () => {
    this.client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          throwOnError: false,
          networkMode: `online`,
          refetchOnMount: false,
          refetchOnReconnect: true,
          refetchOnWindowFocus: true,
          staleTime: DefCacheStaleTime,
          gcTime: DefCacheGarbageColTime,
        },
        mutations: {
          retry: false,
          throwOnError: false,
          networkMode: `online`,
        },
      },
    })

    this.fetch = this.client.fetchQuery.bind(this.client)
  }

  /**
   * Utility to create custom query keys
   * Follows the same pattern as other cache query keys
   */
  key = (
    entity: string,
    operation?: string,
    ...rest: (string | number | object)[]
  ): TReadOnlyQueryKey => {
    const queryKey: TQueryKey = [entity]
    if (operation) queryKey.push(operation)
    queryKey.push(...rest)

    return queryKey
  }
}

export const query = new QueryService()
