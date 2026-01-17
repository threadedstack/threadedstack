import type { ReactNode } from 'react'

import { MemoChildren, Loading } from '@tdsk/components'
import { AppError } from '@TAF/components/AppError/AppError'
import { ProjectsContext } from '@TAF/contexts/ProjectsContext'
import { useProjectsState } from '@TAF/hooks/project/useProjectsState'

export type TProjectsProvider = {
  children: ReactNode
}

export const ProjectsProvider = (props: TProjectsProvider) => {
  const data = useProjectsState()
  const { projects, error } = data

  return (
    <ProjectsContext.Provider value={data}>
      {projects ? (
        <MemoChildren>{props.children}</MemoChildren>
      ) : error ? (
        <AppError message={error} />
      ) : (
        <Loading
          fixed
          full
        />
      )}
    </ProjectsContext.Provider>
  )
}
