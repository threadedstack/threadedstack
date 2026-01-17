import type { useOrgsState } from '@TAF/hooks/org/useOrgsState'
import { createContext } from 'react'

export type TOrgsCtx = ReturnType<typeof useOrgsState>
export const OrgsContext = createContext<TOrgsCtx | null>(null)
