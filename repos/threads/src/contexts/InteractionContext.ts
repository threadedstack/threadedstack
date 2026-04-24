import { createContext, useContext } from 'react'

export type TInteractionCtx = {
  sendKeystroke: (data: string) => void
}

export const InteractionContext = createContext<TInteractionCtx | null>(null)

export const useInteraction = (): TInteractionCtx | null => useContext(InteractionContext)
