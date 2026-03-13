import { useCache } from '@TSC/contexts/CacheContext'
import { useInline } from '@TSC/hooks/components/useInline'
import { deepMerge } from '@keg-hub/jsutils/deepMerge'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'
import { exists } from '@keg-hub/jsutils/exists'
import { ife } from '@keg-hub/jsutils/ife'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isStr } from '@keg-hub/jsutils/isStr'
import { noOp } from '@keg-hub/jsutils/noOp'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'
import { toStr } from '@keg-hub/jsutils/toStr'
import { useCallback, useEffect, useRef, useState } from 'react'

export type THFetchCB<T extends Record<string, any> = Record<string, any>> = (
  ...args: any[]
) => Promise<T>

export type TTriggerRespAObj<T extends Record<string, any> = Record<string, any>> = {
  response: Promise<T>
  clear: (keys: THFetch[`endpoint`]) => void
}

export type TPromiseRes<T extends Record<string, any> = Record<string, any>> = Promise<T>

type TCacheEnableObj = { enabled?: boolean; ttl?: number }
type TCacheEnable = TCacheEnableObj | boolean

export type TFetchCBOpts = Record<string, any>

export type TTriggerProps = TFetchCBOpts & {
  hard?: boolean
  parts?: Array<string> | string
  [key: string]: any
}

export type TTriggerResp<T extends Record<string, any> = Record<string, any>> =
  TPromiseRes<T> & TTriggerRespAObj<T>
export type TTriggerCB<T extends Record<string, any> = Record<string, any>> = ((
  props?: TTriggerProps,
  cacheKey?: string
) => TTriggerResp<T>) & {
  clear?: (keys: THFetch[`endpoint`]) => void
}

export type THFetch<T = any, E extends Error = Error> = {
  auto?: boolean
  cacheKey?: string
  callback: THFetchCB<T>
  cache?: TCacheEnable
  autoArgs: TTriggerProps
  endpoint: Array<string> | string
  onSuccess?: (data: T) => void
  onFailure?: (err: E) => void
  onError?: (error?: string) => void
  onLoading?: (loading?: boolean) => void
}

const defOpts = {
  auto: false,
  autoArgs: emptyObj,
  cache: { enabled: false, ttl: 20 } as TCacheEnableObj,
}

const ArgFuncs = [`onError`, `onLoading`, `onSuccess`, `callback`]

const genKey = (keys: string[]) =>
  keys
    .filter(Boolean)
    .map((item) => toStr(item))
    .join(`-`)
const buildKey = (...args: any[]) =>
  genKey(args.reduce((acc, arg) => (arg ? acc.concat(ensureArr(arg)) : acc), []))

const resolveCache = <T = any>(extOpts: Partial<THFetch<T>> = {}): TCacheEnableObj => {
  return exists<TCacheEnable>(extOpts?.cache)
    ? isObj(extOpts?.cache)
      ? { ...defOpts.cache, ...extOpts?.cache }
      : extOpts?.cache
        ? { enabled: true, ttl: defOpts.cache.ttl }
        : { enabled: false }
    : defOpts.cache
}

const resolveArgs = <T extends Record<string, any> = Record<string, any>>(
  opts: Partial<THFetch<T>> | string,
  func?: THFetchCB<T>,
  extOpts: Partial<THFetch<T>> = {}
) => {
  const cache = resolveCache(extOpts)

  if (isStr(opts))
    return {
      ...defOpts,
      ...extOpts,
      cache,
      endpoint: opts,
      callback: func || extOpts?.callback || (noOp as THFetchCB),
    }

  const callback = isFunc(func)
    ? func
    : extOpts?.callback || opts?.callback || (noOp as THFetchCB)

  return {
    ...deepMerge<THFetch>(defOpts, omitKeys(opts, ArgFuncs), omitKeys(extOpts, ArgFuncs)),
    onError: extOpts?.onError || opts?.onError,
    onLoading: extOpts?.onLoading || opts?.onLoading,
    onSuccess: extOpts?.onSuccess || opts?.onSuccess,
    cache,
    callback,
  }
}

export const useFetch = <T extends Record<string, any> = Record<string, any>>(
  opts: Partial<THFetch<T>> | string,
  func?: THFetchCB<T>,
  extOpts: Partial<THFetch<T>> = {}
) => {
  const {
    auto,
    onError,
    autoArgs,
    endpoint,
    onLoading,
    onSuccess,
    callback: cb,
    cache: cacheObj,
    cacheKey: fetchCacheKey,
  } = resolveArgs<T>(opts, func, extOpts)

  const callback = useInline(cb)
  const cacheKeyRef = useRef<string | null>(null)
  const cache = cacheObj as TCacheEnableObj
  const [data, setData] = useState<T | undefined>()
  const cacheService = useCache()

  const cacheEnabled = Boolean(isObj(cache) && cache?.enabled)

  const onCacheHit = useCallback(async (cacheKey: string) => {
    const cached = cacheService.get(cacheKey)
    const resp = cached instanceof Promise ? await cached : cached
    setData(resp)
    onLoading?.(false)
    onError?.(undefined)
    onSuccess?.(resp as T)

    return resp
  }, [])

  const onCacheMiss = useCallback(
    async (opts: TFetchCBOpts, cacheKey: string) => {
      let resp: T = undefined
      try {
        const pending = callback(opts)
        cacheEnabled &&
          cacheService.set(cacheKey, pending, cache.ttl ?? defOpts.cache.ttl)
        resp = (pending instanceof Promise ? await pending : pending) as T
        setData(resp as T)
        onSuccess?.(resp as T)
      } catch (err) {
        onError?.(err?.message)
      } finally {
        onLoading?.(false)
      }
      return resp
    },
    [cache?.enabled]
  )

  const trigger = useCallback<TTriggerCB<T>>(
    (props: TTriggerProps = emptyObj, cacheKey: string = fetchCacheKey) => {
      const { hard, _debugCache, ...opts } = props

      onLoading?.(true)
      onError?.(undefined)

      cacheKeyRef.current = buildKey(
        endpoint,
        props.parts,
        props?.[cacheKey] || props.id || cacheKey
      )
      const cacheHit =
        cacheEnabled && cacheService.get(cacheKeyRef.current) !== undefined && !hard

      const response = cacheHit
        ? onCacheHit(cacheKeyRef.current)
        : onCacheMiss(opts, cacheKeyRef.current)

      if (_debugCache) {
        console.log(`Cache Key: ${cacheKeyRef.current}`)
        console.log(`Is Cache Hit: ${cacheHit}`)
        console.log(`Call Response`, response)
      }

      const triggerRes = Promise.resolve(response) as TTriggerResp<T>
      triggerRes.response = response
      triggerRes.clear = () => {
        if (!cacheKeyRef.current) return
        cacheService.delete(cacheKeyRef.current)
        cacheKeyRef.current = undefined
      }

      return triggerRes
    },
    [data, cache, endpoint, onCacheHit, onCacheMiss, cacheEnabled]
  )

  trigger.clear = () => {
    if (!cacheKeyRef.current) return
    cacheService.delete(cacheKeyRef.current)
    cacheKeyRef.current = undefined
  }

  useEffect(() => {
    auto && ife(async () => await trigger(autoArgs))
  }, [])

  return trigger
}
