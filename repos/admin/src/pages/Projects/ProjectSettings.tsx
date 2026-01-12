import type { Config } from '@tdsk/domain'

import { Page } from '@TAF/pages/Page/Page'
import { fetchConfigs } from '@TAF/actions/configs'
import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { EditConfigDialog } from './EditConfigDialog'
import { CreateConfigDialog } from './CreateConfigDialog'
import { useProjects, useConfigs } from '@TAF/state/selectors'
import { fetchProject, updateProject, deleteProject } from '@TAF/actions/projects'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Alert,
  Dialog,
  Table,
  Button,
  Divider,
  Tooltip,
  TableRow,
  TextField,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  CardContent,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  TableContainer,
  CircularProgress,
} from '@mui/material'

export type TProjectSettings = {}

export const ProjectSettings = (props: TProjectSettings) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const navigate = useNavigate()
  const [projects] = useProjects()
  const [configs] = useConfigs()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalGitUrl, setOriginalGitUrl] = useState('')
  const [originalBranch, setOriginalBranch] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  const [createConfigDialogOpen, setCreateConfigDialogOpen] = useState(false)
  const [editConfigDialogOpen, setEditConfigDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null)

  const [configSearchQuery, setConfigSearchQuery] = useState('')
  const [configTypeFilter, setConfigTypeFilter] = useState<string>('all')

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (projectId) setActiveprojectId(projectId)
  }, [orgId, projectId])

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return

      setLoading(true)
      setError(null)

      const projectResult = await fetchProject(projectId)
      await fetchConfigs({ projectId })

      if (projectResult.error) {
        setError(projectResult.error.message)
      } else if (projectResult.project) {
        setName(projectResult.project.name || '')
        setGitUrl(projectResult.project.gitUrl || '')
        setBranch(projectResult.project.branch || '')
        setOriginalName(projectResult.project.name || '')
        setOriginalGitUrl(projectResult.project.gitUrl || '')
        setOriginalBranch(projectResult.project.branch || '')
      }

      setLoading(false)
    }
    loadData()
  }, [projectId])

  const project = projects && projectId ? projects[projectId] : null
  const hasChanges =
    name !== originalName || gitUrl !== originalGitUrl || branch !== originalBranch

  const projectConfigs = useMemo(() => {
    if (!configs || !projectId) return []
    let filtered = Object.values(configs).filter(
      (config) => config.projectId === projectId
    )

    if (configSearchQuery.trim()) {
      const query = configSearchQuery.toLowerCase()
      filtered = filtered.filter((config) => {
        const data = JSON.stringify(config.data)
        return (
          data?.toLowerCase().includes(query) || config.id?.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [configs, projectId, configSearchQuery, configTypeFilter])

  const totalConfigsCount = useMemo(() => {
    if (!configs || !projectId) return 0
    return Object.values(configs).filter((config) => config.projectId === projectId)
      .length
  }, [configs, projectId])

  const onSave = async () => {
    if (!projectId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateProject(projectId, { name, gitUrl, branch })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Project updated successfully')
      setOriginalName(name)
      setOriginalGitUrl(gitUrl)
      setOriginalBranch(branch)
    }

    setSaving(false)
  }

  const onDeleteClick = () => {
    setDeleteDialogOpen(true)
    setConfirmName('')
  }

  const onDelete = async () => {
    if (!projectId || !project) return

    const result = await deleteProject(projectId)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(`/orgs/${orgId}/projects`)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard')
    setTimeout(() => setSuccess(null), 2000)
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString()
  }

  const onCreateConfig = () => {
    setCreateConfigDialogOpen(true)
  }

  const onCreateConfigSuccess = async () => {
    projectId && (await fetchConfigs({ projectId }))
  }

  const onEditConfig = (config: Config) => {
    setSelectedConfig(config)
    setEditConfigDialogOpen(true)
  }

  const onEditConfigSuccess = async () => {
    projectId && (await fetchConfigs({ projectId }))
  }

  return (
    <Page className='tdsk-project-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Project Settings
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert
          severity='error'
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {!loading && project && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>General Settings</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label='Project Name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                />
                <TextField
                  label='Git URL'
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  fullWidth
                  placeholder='https://github.com/username/project.git'
                />
                <TextField
                  label='Branch'
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  fullWidth
                  placeholder='main'
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant='contained'
                    onClick={onSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>Project Information</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Project ID
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant='body2'
                    fontFamily='monospace'
                  >
                    {project.id}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => copyToClipboard(project.id)}
                  >
                    <ContentCopyIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Org ID
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant='body2'
                    fontFamily='monospace'
                  >
                    {project.orgId}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => copyToClipboard(project.orgId)}
                  >
                    <ContentCopyIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Box>
              {project.createdAt && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                  >
                    Created
                  </Typography>
                  <Typography variant='body2'>{formatDate(project.createdAt)}</Typography>
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
                  <Typography variant='body2'>{formatDate(project.updatedAt)}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant='h6'>Configurations</Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    {totalConfigsCount} config{totalConfigsCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
                <Button
                  size='small'
                  variant='outlined'
                  startIcon={<AddIcon />}
                  onClick={onCreateConfig}
                >
                  Add Config
                </Button>
              </Box>
              <Divider sx={{ mb: 2 }} />

              {totalConfigsCount > 0 && (
                <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    placeholder='Search configs by key or value...'
                    value={configSearchQuery}
                    onChange={(e) => setConfigSearchQuery(e.target.value)}
                    size='small'
                    sx={{ flex: 1, minWidth: 200 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <SearchIcon color='action' />
                        </InputAdornment>
                      ),
                      endAdornment: configSearchQuery && (
                        <InputAdornment position='end'>
                          <IconButton
                            size='small'
                            onClick={() => setConfigSearchQuery('')}
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

              {totalConfigsCount === 0 && (
                <Typography color='text.secondary'>
                  No configurations found for this project.
                </Typography>
              )}

              {totalConfigsCount > 0 && projectConfigs.length === 0 && (
                <Typography
                  color='text.secondary'
                  align='center'
                >
                  No configurations match your search or filter criteria.
                </Typography>
              )}

              {projectConfigs.length > 0 && (
                <TableContainer>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Key</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell align='right'>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {projectConfigs.map((config) => (
                        <TableRow
                          key={config.id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => onEditConfig(config)}
                        >
                          <TableCell>
                            <Typography
                              variant='body2'
                              fontFamily='monospace'
                            >
                              {config.id}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant='body2'
                              fontFamily='monospace'
                              sx={{
                                maxWidth: 300,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              TODO: config.data
                            </Typography>
                          </TableCell>
                          <TableCell align='right'>
                            <Tooltip title='Edit config'>
                              <IconButton
                                size='small'
                                color='primary'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onEditConfig(config)
                                }}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography
                variant='h6'
                color='error'
              >
                Danger Zone
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant='body1'>Delete this project</Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    Once deleted, this action cannot be undone. All data will be lost.
                  </Typography>
                </Box>
                <Button
                  variant='outlined'
                  color='error'
                  onClick={onDeleteClick}
                >
                  Delete Project
                </Button>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Project?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{project?.name}</strong>? This will
            permanently delete all associated endpoints, functions, secrets, and
            configurations.
          </Typography>
          <TextField
            label='Type project name to confirm'
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color='error'
            variant='contained'
            disabled={confirmName !== project?.name}
            onClick={onDelete}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>

      {projectId && (
        <CreateConfigDialog
          open={createConfigDialogOpen}
          projectId={projectId}
          onClose={() => setCreateConfigDialogOpen(false)}
          onSuccess={onCreateConfigSuccess}
        />
      )}

      <EditConfigDialog
        open={editConfigDialogOpen}
        config={selectedConfig}
        onClose={() => {
          setEditConfigDialogOpen(false)
          setSelectedConfig(null)
        }}
        onSuccess={onEditConfigSuccess}
      />
    </Page>
  )
}

export default ProjectSettings
