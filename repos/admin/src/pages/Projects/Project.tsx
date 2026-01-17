import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useProjects } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { fetchProject, deleteProject } from '@TAF/actions/projects'
import { setActiveOrgId, setActiveProjectId } from '@TAF/state/accessors'
import {
  Edit as EditIcon,
  Folder as ProjectIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Button,
  Divider,
  Tooltip,
  Typography,
  IconButton,
  CardContent,
} from '@mui/material'

export type TProject = {}

export const Project = (props: TProject) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (projectId) setActiveProjectId(projectId)
  }, [orgId, projectId])

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return
      setLoading(true)
      await fetchProject(projectId)
      setLoading(false)
    }
    loadProject()
  }, [projectId])

  const project = projectId && projects ? projects[projectId] : undefined

  const handleBack = () => {
    navigate(`/orgs/${orgId}/projects`)
  }

  const handleDelete = async () => {
    if (!project || !projectId) return
    if (!window.confirm(`Are you sure you want to delete project "${project.name}"?`)) {
      return
    }
    const result = await deleteProject(projectId)
    if (!result.error) {
      navigate(`/orgs/${orgId}/projects`)
    }
  }

  if (loading) {
    return (
      <Page className='tdsk-project-page'>
        <Typography>Loading project...</Typography>
      </Page>
    )
  }

  if (!project) {
    return (
      <Page className='tdsk-project-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Project not found</Typography>
            <Button
              onClick={handleBack}
              sx={{ mt: 2 }}
            >
              Back to Projects
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-project-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title='Back to Projects'>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <ProjectIcon sx={{ color: 'text.secondary' }} />
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {project.name}
        </Typography>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
          disabled
        >
          Edit
        </Button>
        <Button
          variant='outlined'
          color='error'
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='h6'
            gutterBottom
          >
            Project Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Name
            </Typography>
            <Typography variant='body1'>{project.name}</Typography>
          </Box>

          {project.gitUrl && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Git URL
              </Typography>
              <Typography
                variant='body1'
                sx={{ wordBreak: 'break-all' }}
              >
                {project.gitUrl}
              </Typography>
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Branch
            </Typography>
            <Chip
              label={project.branch || 'main'}
              size='small'
              sx={{ mt: 0.5 }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Org ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {project.orgId}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Project ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {project.id}
            </Typography>
          </Box>

          {project.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(project.createdAt).toLocaleString()}
              </Typography>
            </Box>
          )}

          {project.updatedAt && (
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Last Updated
              </Typography>
              <Typography variant='body2'>
                {new Date(project.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {project.meta && Object.keys(project.meta).length > 0 && (
        <Card>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Metadata
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box
              component='pre'
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              {JSON.stringify(project.meta, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}

export default Project
