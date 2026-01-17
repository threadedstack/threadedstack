import type { useOrgState } from '@TAF/hooks/org/useOrgState'
import { createContext } from 'react'

export type TOrgCtx = ReturnType<typeof useOrgState>
export const OrgContext = createContext<TOrgCtx | null>(null)
