import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useProjects } from '@TAF/state/selectors'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { CreateProjectDrawer } from '@TAF/pages/Projects/CreateProjectDrawer'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Grid,
  Chip,
  Button,
  Tooltip,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TProjects = {}

export const Projects = (props: TProjects) => {
  const navigate = useNavigate()
  const [projects, setProjectsState] = useProjects()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true)
      await fetchProjects()
      setLoading(false)
    }
    loadProjects()
  }, [])

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`)
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to delete project "${projectName}"?`)) {
      return
    }
    await deleteProject(projectId)
  }

  const projectsArray = projects ? Object.values(projects) : []

  return (
    <Page className='tdsk-projects-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant='h4'
          component='h1'
        >
          Projects
        </Typography>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Project
        </Button>
      </Box>

      {loading && <Typography>Loading projects...</Typography>}

      {!loading && projectsArray.length === 0 && (
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

      {!loading && projectsArray.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {projectsArray.map((project) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={project.id}
            >
              <Card>
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
                      onClick={() => handleViewProject(project.id)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Project'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDeleteProject(project.id, project.name)}
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

      <CreateProjectDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Projects
