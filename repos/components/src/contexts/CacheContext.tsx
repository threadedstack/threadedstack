import { MemoChildren } from '@TSC/components/MemoChildren'
import { CacheService, GlobalCache } from '@TSC/services/cacheService'
import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'

export type TCacheProvider = {
  children: ReactNode
  global?: boolean
}

const CacheContext = createContext<CacheService | null>(null)
export const useCache = () => useContext(CacheContext) as CacheService

export const CacheProvider = (props: TCacheProvider) => {
  const { global: fromGlobal, ...rest } = props
  const value = fromGlobal !== false ? GlobalCache : new CacheService({ global: false })

  return (
    <CacheContext.Provider value={value}>
      <MemoChildren {...rest} />
    </CacheContext.Provider>
  )
}
