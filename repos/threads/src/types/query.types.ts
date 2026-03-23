export type TQueryKey = (string | number | object)[]
export type TReadOnlyQueryKey = readonly (string | number | object)[]

export type TApiCacheKeys = {
  [key: string]: (...opts: any[]) => TReadOnlyQueryKey
}

export type TQueryCacheKeys = {
  [key: string]: TApiCacheKeys
}

export type TCacheQueryOpts = {
  staleTime?: number
  refetchInterval?: number
  queryKey?: TReadOnlyQueryKey
}
