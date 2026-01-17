import type { useProjectsState } from '@TAF/hooks/project/useProjectsState'
import { createContext } from 'react'

export type TProjectsCtx = ReturnType<typeof useProjectsState>
export const ProjectsContext = createContext<TProjectsCtx | null>(null)
