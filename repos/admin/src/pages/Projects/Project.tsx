import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete, Drawer, TextInput } from '@tdsk/components'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { updateProject } from '@TAF/actions/projects/api/updateProject'
import {
  useAgents,
  useEndpoints,
  useFunctions,
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
} from '@TAF/state/selectors'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Api as ApiIcon,
  Functions as FunctionsIcon,
  SmartToy as AgentIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Grid,
  Alert,
  Button,
  Divider,
  Typography,
  CardContent,
} from '@mui/material'

export type TProject = {}

export const Project = (props: TProject) => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [project] = useActiveProject()
  const [projectId] = useActiveProjectId()
  const [endpoints] = useEndpoints()
  const [functions] = useFunctions()
  const [agents] = useAgents()

  const endpointCount = useMemo(
    () =>
      endpoints
        ? Object.values(endpoints).filter((e) => e.projectId === projectId).length
        : 0,
    [endpoints, projectId]
  )

  const functionCount = useMemo(
    () =>
      functions
        ? Object.values(functions).filter((f) => f.projectId === projectId).length
        : 0,
    [functions, projectId]
  )

  const agentCount = useMemo(
    () =>
      agents
        ? Object.values(agents).filter((a) => a.projects?.some((p) => p.id === projectId))
            .length
        : 0,
    [agents, projectId]
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editGitUrl, setEditGitUrl] = useState('')
  const [editBranch, setEditBranch] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (editOpen && project) {
      setEditName(project.name || '')
      setEditDescription(project.description || '')
      setEditGitUrl(project.gitUrl || '')
      setEditBranch(project.branch || 'main')
      setEditError(null)
    }
  }, [editOpen, project])

  const onBack = () => navigate(`/orgs/${orgId}/projects`)

  const onDeleteClick = () => setDeleteDialogOpen(true)

  const onDelete = async () => {
    if (!project || !projectId) return
    const result = await deleteProject({ orgId, id: projectId })
    !result.error && navigate(`/orgs/${orgId}/projects`)
    setDeleteDialogOpen(false)
  }

  const onDeleteCancel = () => setDeleteDialogOpen(false)

  const onEdit = async () => {
    if (!projectId || !editName.trim()) {
      setEditError('Project name is required')
      return
    }
    setEditLoading(true)
    setEditError(null)
    const result = await updateProject({
      orgId,
      id: projectId,
      data: {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        gitUrl: editGitUrl.trim() || undefined,
        branch: editBranch.trim() || 'main',
      },
    })
    setEditLoading(false)
    if (result.error) {
      setEditError('Failed to update project')
      return
    }
    setEditOpen(false)
  }

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
          onClick={() => setEditOpen(true)}
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

      <Grid
        container
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Grid
          item
          xs={4}
        >
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ApiIcon sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
              <Typography variant='h4'>{endpointCount}</Typography>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Endpoints
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid
          item
          xs={4}
        >
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <FunctionsIcon sx={{ fontSize: 32, color: 'secondary.main', mb: 1 }} />
              <Typography variant='h4'>{functionCount}</Typography>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Functions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid
          item
          xs={4}
        >
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AgentIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
              <Typography variant='h4'>{agentCount}</Typography>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Agents
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Description
            </Typography>
            <Typography variant='body1'>
              {project.description || 'No description provided'}
            </Typography>
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

      <Drawer
        open={editOpen}
        onClose={() => !editLoading && setEditOpen(false)}
        title='Edit Project'
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
          {editError && (
            <Alert
              severity='error'
              onClose={() => setEditError(null)}
            >
              {editError}
            </Alert>
          )}
          <TextInput
            required
            fullWidth
            id='edit-project-name'
            label='Name'
            value={editName}
            disabled={editLoading}
            onChange={(e) => setEditName(e.target.value)}
          />
          <TextInput
            fullWidth
            multiline
            minRows={2}
            id='edit-project-description'
            label='Description'
            value={editDescription}
            disabled={editLoading}
            placeholder='Enter project description (optional)'
            onChange={(e) => setEditDescription(e.target.value)}
          />
          <TextInput
            fullWidth
            id='edit-project-git-url'
            label='Git URL'
            value={editGitUrl}
            disabled={editLoading}
            onChange={(e) => setEditGitUrl(e.target.value)}
          />
          <TextInput
            fullWidth
            id='edit-project-branch'
            label='Branch'
            value={editBranch}
            disabled={editLoading}
            onChange={(e) => setEditBranch(e.target.value)}
          />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
            <Button
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              variant='contained'
              onClick={onEdit}
              disabled={editLoading || !editName.trim()}
            >
              {editLoading ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Drawer>

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
