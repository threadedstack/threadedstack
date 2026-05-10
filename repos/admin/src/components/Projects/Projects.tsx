import { useState, useMemo } from 'react'
import { EPermResource } from '@tdsk/domain'
import { useProjects } from '@TAF/state/selectors'
import { useActiveOrgId } from '@TAF/state/selectors'
import { CardGrid } from '@TAF/components/CardGrid/CardGrid'
import { NoProjects } from '@TAF/components/Projects/NoProjects'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { ProjectCard } from '@TAF/components/Projects/ProjectCard'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { setProjectActive } from '@TAF/actions/projects/local/setProjectActive'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TProjects = {}

export const Projects = (props: TProjects) => {
  const [orgId] = useActiveOrgId()
  const [projects] = useProjects()
  const { canCreate, canDelete } = usePermissions()
  const [searchQuery, setSearchQuery] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const createDisabled = !canCreate(EPermResource.project)
  const deleteDisabled = !canDelete(EPermResource.project)

  const onCreate = () => setDialogOpen(true)

  const onDialogClose = () => setDialogOpen(false)
  const onSelectProject = (projectId: string) => setProjectActive(projectId)

  const onDeleteProject = async (projectId: string) => {
    await deleteProject({ orgId, id: projectId })
  }

  const orgProjects = useMemo(
    () =>
      projects
        ? Object.values(projects).filter((project) => project.orgId === orgId)
        : [],
    [projects, orgId]
  )

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return orgProjects

    const query = searchQuery.toLowerCase()
    return orgProjects.filter(
      (project) =>
        project.name?.toLowerCase().includes(query) ||
        project.id?.toLowerCase().includes(query)
    )
  }, [orgProjects, searchQuery])

  const projectsCount = orgProjects.length
  const hasProjects = projectsCount > 0

  return (
    <PageLayout
      searchCount={0}
      title='Projects'
      query={searchQuery}
      countLabel='project'
      count={projectsCount}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      actionDisabled={createDisabled}
      onAction={hasProjects && onCreate}
      actionLabel={hasProjects && 'Create Project'}
      searchPlaceholder='Search projects by name or ID...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {!error && projectsCount === 0 && (
        <NoProjects
          onCreate={onCreate}
          createDisabled={createDisabled}
        />
      )}

      {!error && projectsCount > 0 && filteredProjects.length === 0 && (
        <EmptyState message='No projects match your search query.' />
      )}

      {!error && filteredProjects.length > 0 && (
        <CardGrid
          items={filteredProjects}
          getKey={(project) => project.id}
          renderCard={(project) => (
            <ProjectCard
              project={project}
              onSelect={onSelectProject}
              onDelete={onDeleteProject}
              showDelete={!deleteDisabled}
            />
          )}
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
