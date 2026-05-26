import { useMemo, useState, useEffect } from 'react'
import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { ActionCards } from '@TAF/components/ActionCards/ActionCards'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { updateProject } from '@TAF/actions/projects/api/updateProject'
import { Drawer, TextInput, ProjectIcon, ConfirmDelete } from '@tdsk/components'
import {
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
  useProjectSecrets,
  useProjectSandboxes,
} from '@TAF/state/selectors'
import {
  Dns as SandboxIcon,
  Api as ApiIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as SecretIcon,
  Functions as FunctionsIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  List,
  Alert,
  Button,
  Divider,
  ListItem,
  Typography,
  CardContent,
  ListItemIcon,
  ListItemText,
} from '@mui/material'

import type { Sandbox, Secret } from '@tdsk/domain'

export type TProject = {}

export const Project = (props: TProject) => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [project] = useActiveProject()
  const [projectId] = useActiveProjectId()

  const [projectSecrets] = useProjectSecrets()
  const [projectSandboxes] = useProjectSandboxes()
  const sandboxList = useMemo<Sandbox[]>(
    () => (projectSandboxes ? Object.values(projectSandboxes) : []),
    [projectSandboxes]
  )
  const secretsList = useMemo<Secret[]>(
    () => (projectSecrets ? Object.values(projectSecrets) : []),
    [projectSecrets]
  )

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (editOpen && project) {
      setEditName(project.name || '')
      setEditDescription(project.description || '')
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
      setEditError(`Project name is required`)
      return
    }
    setEditLoading(true)
    setEditError(null)
    const result = await updateProject({
      orgId,
      id: projectId,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
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

      <ActionCards
        hideHeader
        sx={{ mb: 3 }}
        title='Quick Actions'
        actions={[
          {
            title: 'Sandboxes',
            Icon: SandboxIcon,
            subtitle: `${sandboxList.length} sandbox environments`,
            onClick: () =>
              navigate(buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSandboxes)),
          },
          {
            title: 'Endpoints',
            Icon: ApiIcon,
            subtitle: `${project?.counts?.endpoint ?? 0} endpoints`,
            onClick: () =>
              navigate(buildNavRoute({ orgId, projectId }, ERoutePath.ProjectEndpoints)),
          },
          {
            title: 'Functions',
            Icon: FunctionsIcon,
            subtitle: `${project?.counts?.function ?? 0} functions`,
            onClick: () =>
              navigate(buildNavRoute({ orgId, projectId }, ERoutePath.ProjectFunctions)),
          },
          {
            title: 'Secrets',
            Icon: SecretIcon,
            subtitle: `${secretsList.length} secrets`,
            onClick: () =>
              navigate(buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSecrets)),
          },
        ]}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant='h6'>
              Sandboxes
              {sandboxList.length > 0 && ` (${sandboxList.length})`}
            </Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<SandboxIcon />}
              onClick={() =>
                navigate(buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSandboxes))
              }
            >
              View All
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {sandboxList.length === 0 ? (
            <Typography
              color='text.secondary'
              align='center'
            >
              No sandbox configs in this project yet.
            </Typography>
          ) : (
            <>
              <List disablePadding>
                {sandboxList.slice(0, 5).map((sb) => (
                  <ListItem
                    key={sb.id}
                    sx={{
                      px: 0,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1,
                    }}
                    onClick={() =>
                      navigate(
                        buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSandboxes)
                      )
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <SandboxIcon
                        fontSize='small'
                        sx={{ color: 'text.secondary' }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={sb.name}
                      secondary={
                        [sb.config?.runtime, sb.config?.image]
                          .filter(Boolean)
                          .join(' \u2014 ') || undefined
                      }
                    />
                    {sb.builtIn && (
                      <Chip
                        label='built-in'
                        size='small'
                        color='info'
                        variant='outlined'
                      />
                    )}
                  </ListItem>
                ))}
              </List>
              {sandboxList.length > 5 && (
                <Button
                  size='small'
                  onClick={() =>
                    navigate(
                      buildNavRoute({ orgId, projectId }, ERoutePath.ProjectSandboxes)
                    )
                  }
                  sx={{ mt: 1 }}
                >
                  View all {sandboxList.length} sandboxes
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
