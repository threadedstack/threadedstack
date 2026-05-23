import type { TOpenSession } from '@TTH/types'

import { createContext, useContext } from 'react'

export type TSessionCtx = {
  isOwner: boolean
  connecting: boolean
  sandboxId: string | undefined
  projectId: string | undefined
  instanceId: string | undefined
  session: TOpenSession | undefined
}

export const SessionContext = createContext<TSessionCtx | null>(null)

export const useSessionContext = () => {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error(`useSessionContext must be used within SessionProvider`)
  return ctx
}
