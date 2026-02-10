import { useState, useMemo } from 'react'
import { useProjects } from '@TAF/state/selectors'
import { useActiveOrgId } from '@TAF/state/selectors'
import { NoProjects } from '@TAF/components/Projects/NoProjects'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
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

  const onCreate = () => setDialogOpen(true)

  const onDialogClose = () => setDialogOpen(false)
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
    <PageLayout
      searchCount={0}
      title='Projects'
      query={searchQuery}
      countLabel='project'
      count={projectsCount}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      onAction={hasProjects && onCreate}
      actionLabel={hasProjects && 'Create Project'}
      searchPlaceholder='Search projects by name, URL, or branch...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
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
    </PageLayout>
  )
}
