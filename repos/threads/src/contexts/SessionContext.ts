import type { TOpenSession, TPendingOp } from '@TTH/types'

import { createContext, useContext } from 'react'

export type TSessionCtx = {
  isOwner: boolean
  connecting: boolean
  pendingOp: TPendingOp
  sandboxId: string | undefined
  projectId: string | undefined
  session: TOpenSession | undefined
  setPendingOp: (op: TPendingOp) => void
}

export const SessionContext = createContext<TSessionCtx | null>(null)

export const useSessionContext = () => {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error(`useSessionContext must be used within SessionProvider`)
  return ctx
}
