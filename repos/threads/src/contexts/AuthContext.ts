import type { TAuthSession } from '@TTH/types'

import { createContext } from 'react'

export type TAuthCtx = {
  loading?: boolean
  session: TAuthSession
}

export const AuthContext = createContext<TAuthCtx | null>(null)
