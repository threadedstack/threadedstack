import type { Function as TDFunction } from '@tdsk/domain'

import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useFunctions } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { EditFunctionDialog } from './EditFunctionDialog'
import { CreateFunctionDialog } from './CreateFunctionDialog'
import { fetchFunctions, deleteFunction } from '@TAF/actions/functions'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
import {
  SearchBar,
  FilterSelect,
  PageHeader,
  EmptyState,
  LoadingSpinner,
} from '@TAF/components'
import {
  Add as AddIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
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

export type TProjectFunctions = {}

export const ProjectFunctions = (props: TProjectFunctions) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const [functions] = useFunctions()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedFunction, setSelectedFunction] = useState<TDFunction | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [languageFilter, setLanguageFilter] = useState<string>('all')

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (projectId) setActiveprojectId(projectId)
  }, [orgId, projectId])

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return
      setLoading(true)
      await fetchFunctions({ projectId })
      setLoading(false)
    }
    loadData()
  }, [projectId])

  const filteredFunctions = useMemo(() => {
    if (!functions || !projectId) return []

    let filtered = Object.values(functions).filter((func) => func.projectId === projectId)

    if (languageFilter !== 'all') {
      filtered = filtered.filter((func) => func.language === languageFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (func) =>
          func.name?.toLowerCase().includes(query) ||
          func.id?.toLowerCase().includes(query) ||
          func.endpointId?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [functions, projectId, searchQuery, languageFilter])

  const languageFilterOptions = useMemo(() => {
    if (!functions || !projectId) return []
    const languages = new Set<string>()
    Object.values(functions)
      .filter((func) => func.projectId === projectId)
      .forEach((func) => {
        if (func.language) languages.add(func.language)
      })
    return Array.from(languages)
      .sort()
      .map((lang) => ({ value: lang, label: lang }))
  }, [functions, projectId])

  const functionsCount = functions
    ? Object.values(functions).filter((f) => f.projectId === projectId).length
    : 0

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete function "${name}"?`)) {
      return
    }
    const result = await deleteFunction(id)
    if (result.error) {
      alert(`Failed to delete function: ${result.error.message}`)
    }
  }

  const onCreate = () => {
    setCreateDialogOpen(true)
  }

  const onCreateSuccess = async () => {
    projectId && (await fetchFunctions({ projectId }))
  }

  const onEdit = (func: TDFunction) => {
    setSelectedFunction(func)
    setEditDialogOpen(true)
  }

  const onEditSuccess = async () => {
    projectId && (await fetchFunctions({ projectId }))
  }

  return (
    <Page className='tdsk-project-functions-page'>
      <PageHeader
        title='Project Functions'
        count={functionsCount}
        countLabel='function'
        actionLabel='Create Function'
        actionIcon={<AddIcon />}
        onAction={onCreate}
      />

      {!loading && functionsCount > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search functions by name...'
            sx={{ flex: 1, minWidth: 200 }}
          />
          {languageFilterOptions.length > 1 && (
            <FilterSelect
              id='language-filter'
              label='Language'
              value={languageFilter}
              onChange={setLanguageFilter}
              options={languageFilterOptions}
              allLabel='All Languages'
              minWidth={140}
            />
          )}
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {!loading && functionsCount === 0 && (
        <EmptyState
          message='No functions found for this project.'
          actionLabel='Create Your First Function'
          actionIcon={<AddIcon />}
          onAction={onCreate}
        />
      )}

      {!loading && functionsCount > 0 && filteredFunctions.length === 0 && (
        <EmptyState message='No functions match your search or filter criteria.' />
      )}

      {!loading && filteredFunctions.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {filteredFunctions.map((func) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={func.id}
            >
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                }}
                onClick={() => onEdit(func)}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <CodeIcon color='primary' />
                    <Typography
                      variant='h6'
                      component='div'
                    >
                      {func.name}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      Language
                    </Typography>
                    <Chip
                      label={func.language}
                      size='small'
                      color='primary'
                      variant='outlined'
                      sx={{ mt: 0.5 }}
                    />
                  </Box>

                  {func.endpointId && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        display='block'
                      >
                        Endpoint
                      </Typography>
                      <Typography
                        variant='body2'
                        fontFamily='monospace'
                        sx={{ wordBreak: 'break-all', mt: 0.5 }}
                      >
                        {func.endpointId}
                      </Typography>
                    </Box>
                  )}

                  {func.createdAt && (
                    <Box>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        display='block'
                      >
                        Created
                      </Typography>
                      <Typography
                        variant='body2'
                        sx={{ mt: 0.5 }}
                      >
                        {new Date(func.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                  <Button
                    size='small'
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(func)
                    }}
                  >
                    Edit
                  </Button>
                  <Tooltip title='Delete function'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(func.id, func.name)
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

      {projectId && (
        <>
          <CreateFunctionDialog
            open={createDialogOpen}
            projectId={projectId}
            onClose={() => setCreateDialogOpen(false)}
            onSuccess={onCreateSuccess}
          />
          <EditFunctionDialog
            open={editDialogOpen}
            func={selectedFunction}
            onClose={() => {
              setEditDialogOpen(false)
              setSelectedFunction(null)
            }}
            onSuccess={onEditSuccess}
          />
        </>
      )}
    </Page>
  )
}

export default ProjectFunctions
