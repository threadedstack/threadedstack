import type { TAuthSession } from '@TAF/types'

import { createContext } from 'react'

export type TAuthCtx = {
  loading?:boolean
  session: TAuthSession
}

export const AuthContext = createContext<TAuthCtx | null>(null)
