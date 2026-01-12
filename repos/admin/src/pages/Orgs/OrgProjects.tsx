import { Page } from '@TAF/pages/Page/Page'
import { useProjects } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchProjects, deleteProject } from '@TAF/actions/projects'
import { CreateOrgProjectDialog } from '@TAF/pages/Orgs/CreateOrgProjectDialog'
import {
  Add as AddIcon,
  Folder as ProjectIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Grid,
  Chip,
  Button,
  Tooltip,
  TextField,
  IconButton,
  Typography,
  CardContent,
  CardActions,
  InputAdornment,
  CircularProgress,
} from '@mui/material'

export type TOrgProjects = {}

export const OrgProjects = (props: TOrgProjects) => {
  const navigate = useNavigate()
  const { orgId } = useParams<{ orgId: string }>()
  const [projects] = useProjects()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync active org with URL params
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

  const onCreateClick = () => {
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
  }

  const onDialogSuccess = async () => {
    await fetchProjects()
  }

  const onViewProject = (projectId: string) => {
    navigate(`/orgs/${orgId}/projects/${projectId}`)
  }

  const onDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"?`)) {
      return
    }
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
    <Page className='tdsk-org-projects-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography
            variant='h4'
            component='h1'
          >
            Organization Projects
          </Typography>
          <Typography color='text.secondary'>
            {projectsCount} project{projectsCount !== 1 ? '' : 's'}
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create Project
        </Button>
      </Box>

      {!loading && projectsCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <TextField
            placeholder='Search projects by name, URL, or branch...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size='small'
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon color='action' />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position='end'>
                  <IconButton
                    size='small'
                    onClick={() => setSearchQuery('')}
                    edge='end'
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color='error'>Error loading projects: {error.message}</Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && projectsCount === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No projects yet. Create your first project to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && projectsCount > 0 && filteredProjects.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No projects match your search query.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredProjects.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {filteredProjects.map((project) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={project.id}
            >
              <Card
                sx={{ cursor: 'pointer' }}
                onClick={() => onViewProject(project.id)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ProjectIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography
                      variant='h6'
                      component='h2'
                    >
                      {project.name}
                    </Typography>
                  </Box>

                  {project.gitUrl && (
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ mb: 1, wordBreak: 'break-all' }}
                    >
                      {project.gitUrl}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {project.branch && (
                      <Chip
                        label={project.branch}
                        size='small'
                        variant='outlined'
                      />
                    )}
                  </Box>

                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    ID: {project.id}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Tooltip title='View Project'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewProject(project.id)
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Project'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteProject(project.id, project.name)
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {orgId && (
        <CreateOrgProjectDialog
          open={dialogOpen}
          orgId={orgId}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </Page>
  )
}

export default OrgProjects
