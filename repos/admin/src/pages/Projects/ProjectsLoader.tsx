import type { ReactNode } from 'react'
import { Outlet } from 'react-router'
import { ProjectsProvider } from '@TAF/contexts/ProjectsProvider'

export type TProjectsLoader = {
  children?: ReactNode
}

export const ProjectsLoader = (props: TProjectsLoader) => {
  return (
    <ProjectsProvider>
      <Outlet />
      {props.children}
    </ProjectsProvider>
  )
}

export default ProjectsLoader
