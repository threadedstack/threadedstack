import { Grid } from '@mui/material'
import type { Project } from '@tdsk/domain'
import { ProjectCard } from '@TAF/components/Projects/ProjectCard'

export type TProjectsGrid = {
  showDelete?: boolean
  projects: Project[]
  onDelete?: (projectId: string) => void
  onView?: (projectId: string) => void
}

export const ProjectsGrid = (props: TProjectsGrid) => {
  const { projects, onDelete, onView, showDelete } = props

  return (
    <Grid
      container
      spacing={3}
    >
      {projects.map((project) => (
        <Grid
          item
          xs={12}
          sm={6}
          md={4}
          key={project.id}
        >
          <ProjectCard
            project={project}
            onDelete={onDelete}
            onView={onView}
            showDelete={showDelete}
          />
        </Grid>
      ))}
    </Grid>
  )
}
