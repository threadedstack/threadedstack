import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
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
import { Box, Card, Chip, Button, Divider, Typography, CardContent } from '@mui/material'

export type TProject = {}

export const Project = (props: TProject) => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [project] = useActiveProject()
  const [projectId] = useActiveProjectId()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const onBack = () => navigate(`/orgs/${orgId}/projects`)

  const onDeleteClick = () => setDeleteDialogOpen(true)

  const onDelete = async () => {
    if (!project || !projectId) return
    const result = await deleteProject({ orgId, id: projectId })
    !result.error && navigate(`/orgs/${orgId}/projects`)
    setDeleteDialogOpen(false)
  }

  const onDeleteCancel = () => setDeleteDialogOpen(false)

  if (!project) {
    return (
      <Page className='tdsk-project-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Project not found</Typography>
            <Button
              sx={{ mt: 2 }}
              onClick={onBack}
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
          color='error'
          variant='outlined'
          onClick={onDeleteClick}
          startIcon={<DeleteIcon />}
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

      <ConfirmDelete
        onConfirm={onDelete}
        title='Delete Project?'
        open={deleteDialogOpen}
        itemName={project?.name}
        onCancel={onDeleteCancel}
        warnText='This will permanently delete the project and all its associated endpoints, functions, secrets, and configurations.'
      />
    </Page>
  )
}

export default Project
