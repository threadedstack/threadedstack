import { Page } from '@TAF/pages/Page/Page'
import { useNavigate } from 'react-router'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import {
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
} from '@TAF/state/selectors'
import {
  Edit as EditIcon,
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
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [project] = useActiveProject()
  const [projectId] = useActiveProjectId()

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
