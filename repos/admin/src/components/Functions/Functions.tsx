import type { Function as TDFunction } from '@tdsk/domain'

import { Box } from '@mui/material'
import { ife } from '@keg-hub/jsutils/ife'
import { ConfirmDelete } from '@tdsk/components'
import { useFunctions, useActiveOrgId } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useActiveProjectId } from '@TAF/state/selectors'
import { NoFunctions } from '@TAF/components/Functions/NoFunctions'
import { deleteFunction } from '@TAF/actions/functions/deleteFunction'
import { fetchFunctions } from '@TAF/actions/functions/fetchFunctions'
import { FunctionsGrid } from '@TAF/components/Functions/FunctionsGrid'
import { FunctionDrawer } from '@TAF/components/Functions/FunctionDrawer'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { SearchBar, EmptyState, FilterSelect } from '@TAF/components'

export type TFunctions = {}

export const Functions = (props: TFunctions) => {
  const [functions] = useFunctions()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [selectedFunction, setSelectedFunction] = useState<TDFunction | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [functionToDelete, setFunctionToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    orgId &&
      projectId &&
      ife(async () => {
        try {
          setLoading(true)
          await fetchFunctions({ orgId, projectId })
        } finally {
          setLoading(false)
        }
      })
  }, [orgId, projectId])

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
      .forEach((func) => func.language && languages.add(func.language))

    return Array.from(languages)
      .sort()
      .map((lang) => ({ value: lang, label: lang }))
  }, [functions, projectId])

  const functionsCount = functions
    ? Object.values(functions).filter((f) => f.projectId === projectId).length
    : 0

  const onDelete = (id: string, name: string) => {
    setFunctionToDelete({ id, name })
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

  const onDialogSuccess = async () => {
    orgId && projectId && (await fetchFunctions({ orgId, projectId }))
  }

  const onEdit = (func: TDFunction) => {
    setSelectedFunction(func)
    setDialogOpen(true)
  }

  return (
    <PageLayout
      loading={loading}
      title='Project Functions'
      count={functionsCount}
      countLabel='function'
      onAction={onCreate}
      actionLabel='Create Function'
    >
      {!loading && functionsCount > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            sx={{ flex: 1, minWidth: 200 }}
            placeholder='Search functions by name...'
          />
          {languageFilterOptions.length > 1 && (
            <FilterSelect
              label='Language'
              id='language-filter'
              value={languageFilter}
              allLabel='All Languages'
              sx={{ minWidth: `140px` }}
              onChange={setLanguageFilter}
              options={languageFilterOptions}
            />
          )}
        </Box>
      )}

      {!loading && functionsCount === 0 && <NoFunctions onCreate={onCreate} />}

      {!loading && functionsCount > 0 && filteredFunctions.length === 0 && (
        <EmptyState message='No functions match your search or filter criteria.' />
      )}

      {!loading && filteredFunctions.length > 0 && (
        <FunctionsGrid
          functions={filteredFunctions}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {orgId && projectId && (
        <FunctionDrawer
          orgId={orgId!}
          open={dialogOpen}
          projectId={projectId}
          func={selectedFunction}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
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
