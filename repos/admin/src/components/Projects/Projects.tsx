import { Box } from '@mui/material'
import { useState, useMemo } from 'react'
import { useProjects } from '@TAF/state/selectors'
import { Add as AddIcon } from '@mui/icons-material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { NoProjects } from '@TAF/components/Projects/NoProjects'
import { PageHeader } from '@TAF/components/PageHeader/PageHeader'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ProjectsGrid } from '@TAF/components/Projects/ProjectsGrid'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { setProjectActive } from '@TAF/actions/projects/local/setProjectActive'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TProjects = {}

export const Projects = (props: TProjects) => {
  const [orgId] = useActiveOrgId()
  const [projects] = useProjects()
  const [searchQuery, setSearchQuery] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const onCreate = () => {
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
  }

  const onSelectProject = (projectId: string) => setProjectActive(projectId)

  const onDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
  }

  const filteredProjects = useMemo(() => {
    const orgProjects = projects
      ? Object.values(projects).filter((project) => project.orgId === orgId)
      : []

    if (!searchQuery.trim()) return orgProjects

    const query = searchQuery.toLowerCase()
    return orgProjects.filter(
      (project) =>
        project.name?.toLowerCase().includes(query) ||
        project.gitUrl?.toLowerCase().includes(query) ||
        project.branch?.toLowerCase().includes(query) ||
        project.id?.toLowerCase().includes(query)
    )
  }, [projects, orgId, searchQuery])

  const projectsCount = projects
    ? Object.values(projects).filter((project) => project.orgId === orgId).length
    : 0

  const hasProjects = Boolean(projectsCount)

  return (
    <>
      <PageHeader
        title='Projects'
        countLabel='project'
        count={projectsCount}
        actionIcon={<AddIcon />}
        onAction={hasProjects && onCreate}
        actionLabel={hasProjects && 'Create Project'}
      />

      {projectsCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search projects by name, URL, or branch...'
          />
        </Box>
      )}

      {error && (
        <ErrorAlert
          message={`Error loading projects: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!error && projectsCount === 0 && <NoProjects onCreate={onCreate} />}

      {!error && projectsCount > 0 && filteredProjects.length === 0 && (
        <EmptyState message='No projects match your search query.' />
      )}

      {!error && filteredProjects.length > 0 && (
        <ProjectsGrid
          showDelete={true}
          onSelect={onSelectProject}
          onDelete={onDeleteProject}
          projects={filteredProjects}
        />
      )}

      {orgId && (
        <CreateProjectDrawer
          open={dialogOpen}
          onClose={onDialogClose}
        />
      )}
    </>
  )
}
