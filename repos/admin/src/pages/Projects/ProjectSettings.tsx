import type { Config } from '@tdsk/domain'

import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { fetchConfigs } from '@TAF/actions/configs'
import { useEffect, useState, useMemo } from 'react'
import { LoadingSpinner, ErrorAlert } from '@TAF/components'
import { useProjects, useConfigs } from '@TAF/state/selectors'
import { fetchProject } from '@TAF/actions/projects/api/fetchProject'
import { updateProject } from '@TAF/actions/projects/api/updateProject'
import { deleteProject } from '@TAF/actions/projects/api/deleteProject'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { EditConfigDrawer } from '@TAF/components/Projects/EditConfigDrawer'
import { CreateConfigDrawer } from '@TAF/components/Projects/CreateConfigDrawer'
import { InfoCard, DangerZoneCard, SettingsFormCard } from '@TAF/components/Settings'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Alert,
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
  InputAdornment,
  TableContainer,
} from '@mui/material'

export type TProjectSettings = {}

// TODO: clean this up to work like Org settings
export const ProjectSettings = (props: TProjectSettings) => {
  const navigate = useNavigate()
  const [configs] = useConfigs()
  const [projects] = useProjects()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalGitUrl, setOriginalGitUrl] = useState('')
  const [originalBranch, setOriginalBranch] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [createConfigDialogOpen, setCreateConfigDialogOpen] = useState(false)
  const [editConfigDialogOpen, setEditConfigDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<Config | null>(null)

  const [configSearchQuery, setConfigSearchQuery] = useState('')
  const [configTypeFilter, setConfigTypeFilter] = useState<string>('all')

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return

      setLoading(true)
      setError(null)

      const projectResult = await fetchProject({ orgId, id: projectId })
      await fetchConfigs({ orgId, projectId })

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

    const result = await updateProject({
      orgId,
      id: projectId,
      data: { name, gitUrl, branch },
    })

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
  }

  const onDelete = async () => {
    if (!projectId || !project) return

    const result = await deleteProject({ orgId, id: projectId })

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(`/orgs/${orgId}/projects`)
    }
  }

  const onCopySuccess = (message: string) => {
    setSuccess(message)
    setTimeout(() => setSuccess(null), 2000)
  }

  const onCreateConfig = () => {
    setCreateConfigDialogOpen(true)
  }

  const onCreateConfigSuccess = async () => {
    projectId && orgId && (await fetchConfigs({ orgId, projectId }))
  }

  const onEditConfig = (config: Config) => {
    setSelectedConfig(config)
    setEditConfigDialogOpen(true)
  }

  const onEditConfigSuccess = async () => {
    projectId && orgId && (await fetchConfigs({ orgId, projectId }))
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

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={error}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
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
          <SettingsFormCard
            fields={[
              {
                name: 'name',
                label: 'Project Name',
                value: name,
                onChange: setName,
              },
              {
                name: 'gitUrl',
                label: 'Git URL',
                value: gitUrl,
                onChange: setGitUrl,
                placeholder: 'https://github.com/username/project.git',
              },
              {
                name: 'branch',
                label: 'Branch',
                value: branch,
                onChange: setBranch,
                placeholder: 'main',
              },
            ]}
            onSave={onSave}
            hasChanges={hasChanges}
            saving={saving}
          />

          <InfoCard
            title='Project Information'
            items={[
              { label: 'Project ID', value: project.id, copyable: true },
              { label: 'Org ID', value: project.orgId, copyable: true },
              ...(project.createdAt
                ? [{ label: 'Created', value: String(project.createdAt), isDate: true }]
                : []),
              ...(project.updatedAt
                ? [
                    {
                      label: 'Last Updated',
                      value: String(project.updatedAt),
                      isDate: true,
                    },
                  ]
                : []),
            ]}
            onCopy={onCopySuccess}
          />

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

          <DangerZoneCard
            onAction={onDeleteClick}
            title='Delete this project'
            buttonLabel='Delete Project'
            description='Once deleted, this action cannot be undone. All data will be lost.'
          />
        </>
      )}

      <ConfirmDelete
        onConfirm={onDelete}
        title='Delete Project?'
        open={deleteDialogOpen}
        itemName={project?.name}
        onCancel={() => setDeleteDialogOpen(false)}
        warnText='This will permanently delete all associated endpoints, functions, secrets, and configurations.'
      />

      {/* TODO: Combine CreateConfigDrawer and EditConfigDrawer */}
      {orgId && projectId && (
        <CreateConfigDrawer
          orgId={orgId}
          projectId={projectId}
          open={createConfigDialogOpen}
          onSuccess={onCreateConfigSuccess}
          onClose={() => setCreateConfigDialogOpen(false)}
        />
      )}

      {orgId && (
        <EditConfigDrawer
          orgId={orgId}
          projectId={projectId}
          config={selectedConfig}
          open={editConfigDialogOpen}
          onSuccess={onEditConfigSuccess}
          onClose={() => {
            setEditConfigDialogOpen(false)
            setSelectedConfig(null)
          }}
        />
      )}
    </Page>
  )
}

export default ProjectSettings
