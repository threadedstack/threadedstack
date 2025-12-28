import type { TCache } from '@TSC/types'

import { flatUnion } from '@keg-hub/jsutils/flatUnion'
import { isStr } from '@keg-hub/jsutils/isStr'
import { toStr } from '@keg-hub/jsutils/toStr'

const globalCache = new Map<string, TCache>()

export type TCacheService = {
  global?: boolean
}

export class CacheService {
  cache: Map<string, TCache>

  constructor(props: TCacheService) {
    this.cache = props.global === false ? new Map<string, TCache>() : globalCache
  }

  get = (key: string) => {
    const cacheValue = this.cache.get(key)
    if (!cacheValue) return undefined

    const currentTime = new Date().getTime()
    const cacheTime = cacheValue.expiry.getTime()
    if (currentTime < cacheTime) return cacheValue.data

    this.cache.delete(key)
    return undefined
  }

  set = (key: string, value: any, ttl: number = 10) => {
    const expiry = new Date()
    expiry.setSeconds(expiry.getSeconds() + ttl)
    this.cache.set(key, { expiry: expiry, data: value })
  }

  clear = () => this.cache.clear()

  delete = (key: string) => this.cache.delete(key)

  key = (...args: any[]) => {
    return flatUnion(...args)
      .map((item) => (isStr(item) ? item : toStr(item)))
      .join(`-`)
  }
}

export const GlobalCache = new CacheService({ global: true })
