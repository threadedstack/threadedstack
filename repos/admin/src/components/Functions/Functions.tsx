import type { Function as FunctionModel } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { ConfirmDelete } from '@tdsk/components'
import { useState, useMemo } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { EmptyState, DataTable } from '@TAF/components'
import { useActiveProjectId } from '@TAF/state/selectors'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { NoFunctions } from '@TAF/components/Functions/NoFunctions'
import { useProjectFunctions, useActiveOrgId } from '@TAF/state/selectors'
import { deleteFunction } from '@TAF/actions/functions'
import { FunctionDrawer } from '@TAF/components/Functions/FunctionDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'

import { Code as CodeIcon, Delete as DeleteIcon } from '@mui/icons-material'

export type TFunctions = {}

export const Functions = (props: TFunctions) => {
  const [functions] = useProjectFunctions()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [languageFilter, setLanguageFilter] = useState<string>(`all`)
  const [selectedFunction, setSelectedFunction] = useState<FunctionModel | null>(null)
  const [functionToDelete, setFunctionToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const filteredFunctions = useMemo(() => {
    if (!functions) return []

    let filtered = Object.values(functions)

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
  }, [functions, searchQuery, languageFilter])

  const languageFilterOptions = useMemo(() => {
    if (!functions) return []
    const languages = new Set<string>()

    Object.values(functions).forEach(
      (func) => func.language && languages.add(func.language)
    )

    return Array.from(languages)
      .sort()
      .map((lang) => ({ value: lang, label: lang }))
  }, [functions])

  const functionsCount = functions ? Object.keys(functions).length : 0

  const onDelete = (func: FunctionModel) => {
    setFunctionToDelete({ id: func.id, name: func.name })
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!functionToDelete) return

    const result = await deleteFunction({ orgId, projectId, id: functionToDelete.id })
    setDeleteDialogOpen(false)
    !result.error && setFunctionToDelete(null)
  }

  const onDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setFunctionToDelete(null)
  }

  const onCreate = () => {
    setSelectedFunction(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedFunction(null)
  }

  const onEdit = (func: FunctionModel) => {
    setSelectedFunction(func)
    setDialogOpen(true)
  }

  const columns: TDataTableColumn<FunctionModel>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (func) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {func.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'language',
      label: 'Language',
      render: (func) => (
        <Chip
          label={func.language}
          size='small'
          color='primary'
          variant='outlined'
        />
      ),
    },
    {
      id: 'endpoint',
      label: 'Endpoint',
      render: (func) => (
        <Typography
          variant='body2'
          fontFamily='monospace'
          color='text.secondary'
        >
          {func.endpointId || '—'}
        </Typography>
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      render: (func) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {func.createdAt ? new Date(func.createdAt).toLocaleDateString() : '—'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (func) => (
        <ActionIconButton
          tooltip='Delete function'
          icon={<DeleteIcon />}
          size='small'
          color='error'
          onClick={(e) => {
            e.stopPropagation()
            onDelete(func)
          }}
        />
      ),
    },
  ]

  return (
    <PageLayout
      title='Functions'
      count={functionsCount}
      countLabel='function'
      query={searchQuery}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search functions by name...'
      searchCount={0}
      onAction={functionsCount > 0 && onCreate}
      actionLabel={functionsCount > 0 && 'Create Function'}
      filterLabel='Language'
      filterValue={languageFilter}
      filterAllLabel='All Languages'
      filterOpts={languageFilterOptions.length > 1 ? languageFilterOptions : undefined}
      onFilter={languageFilterOptions.length > 1 ? setLanguageFilter : undefined}
    >
      {functionsCount === 0 && <NoFunctions onCreate={onCreate} />}

      {functionsCount > 0 && filteredFunctions.length === 0 && (
        <EmptyState message='No functions match your search or filter criteria.' />
      )}

      {filteredFunctions.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredFunctions}
          getRowKey={(func) => func.id}
          onRowClick={onEdit}
        />
      )}

      {orgId && projectId && (
        <FunctionDrawer
          orgId={orgId!}
          open={dialogOpen}
          projectId={projectId}
          func={selectedFunction}
          onClose={onDialogClose}
        />
      )}

      <ConfirmDelete
        open={deleteDialogOpen}
        title='Delete Function?'
        onCancel={onDeleteCancel}
        onConfirm={onDeleteConfirm}
        itemName={functionToDelete?.name}
        warnText='This will permanently delete the function and all its associated configuration.'
      />
    </PageLayout>
  )
}
