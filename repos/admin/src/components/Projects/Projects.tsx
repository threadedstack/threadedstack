import { Box } from '@mui/material'
import { useNavigate } from 'react-router'
import { useProjects } from '@TAF/state/selectors'
import { Add as AddIcon } from '@mui/icons-material'
import { useEffect, useState, useMemo } from 'react'
import { setActiveOrgId } from '@TAF/state/accessors'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { NoProjects } from '@TAF/components/Projects/NoProjects'
import { PageHeader } from '@TAF/components/PageHeader/PageHeader'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ProjectsGrid } from '@TAF/components/Projects/ProjectsGrid'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'
import { CreateProjectDialog } from '@TAF/components/Projects/CreateProjectDialog'

export type TProjects = {
  orgId: string
}

export const Projects = (props: TProjects) => {
  const { orgId } = props
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync active org with prop
  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  // Load org projects
  useEffect(() => {
    const loadProjects = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchProjects({ orgId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadProjects()
  }, [orgId])

  const onCreate = () => {
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
  }

  const onDialogSuccess = async () => {
    await fetchProjects({ orgId })
  }

  const onViewProject = (projectId: string) => {
    navigate(`/orgs/${orgId}/projects/${projectId}`)
  }

  const onDeleteProject = async (projectId: string) => {
    await deleteProject(projectId)
  }

  // Filter projects by orgId and search query
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

  return (
    <>
      <PageHeader
        title='Organization Projects'
        count={projectsCount}
        countLabel='project'
        actionLabel='Create Project'
        actionIcon={<AddIcon />}
        onAction={onCreate}
      />

      {!loading && projectsCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search projects by name, URL, or branch...'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading projects: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && projectsCount === 0 && <NoProjects onCreate={onCreate} />}

      {!loading && !error && projectsCount > 0 && filteredProjects.length === 0 && (
        <EmptyState message='No projects match your search query.' />
      )}

      {!loading && !error && filteredProjects.length > 0 && (
        <ProjectsGrid
          projects={filteredProjects}
          showDelete={true}
          onDelete={onDeleteProject}
          onView={onViewProject}
        />
      )}

      {orgId && (
        <CreateProjectDialog
          open={dialogOpen}
          orgId={orgId}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </>
  )
}
