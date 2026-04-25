import type { TInteractionCtx } from '@TTH/types/contexts.types'

import { createContext, useContext } from 'react'

export const InteractionContext = createContext<TInteractionCtx | null>(null)

export const useInteraction = (): TInteractionCtx | null => useContext(InteractionContext)
