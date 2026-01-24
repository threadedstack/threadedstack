import type { Function as TDFunction } from '@tdsk/domain'

import { Box } from '@mui/material'
import { ife } from '@keg-hub/jsutils/ife'
import { Add as AddIcon } from '@mui/icons-material'
import { useFunctions } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useActiveProjectId } from '@TAF/state/selectors'
import { NoFunctions } from '@TAF/components/Functions/NoFunctions'
import { deleteFunction } from '@TAF/actions/functions/deleteFunction'
import { fetchFunctions } from '@TAF/actions/functions/fetchFunctions'
import { FunctionsGrid } from '@TAF/components/Functions/FunctionsGrid'
import { FunctionDialog } from '@TAF/components/Functions/FunctionDialog'
import {
  SearchBar,
  PageHeader,
  EmptyState,
  FilterSelect,
  LoadingSpinner,
} from '@TAF/components'

export type TFunctions = {}

export const Functions = (props: TFunctions) => {
  const [functions] = useFunctions()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [languageFilter, setLanguageFilter] = useState<string>('all')
  const [selectedFunction, setSelectedFunction] = useState<TDFunction | null>(null)

  useEffect(() => {
    projectId &&
      ife(async () => {
        try {
          setLoading(true)
          await fetchFunctions({ projectId })
        } finally {
          setLoading(false)
        }
      })
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
      .forEach((func) => func.language && languages.add(func.language))

    return Array.from(languages)
      .sort()
      .map((lang) => ({ value: lang, label: lang }))
  }, [functions, projectId])

  const functionsCount = functions
    ? Object.values(functions).filter((f) => f.projectId === projectId).length
    : 0

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete function "${name}"?`)) return

    const result = await deleteFunction(id)
    if (result.error) alert(`Failed to delete function: ${result.error.message}`)
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
    projectId && (await fetchFunctions({ projectId }))
  }

  const onEdit = (func: TDFunction) => {
    setSelectedFunction(func)
    setDialogOpen(true)
  }

  return (
    <>
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

      {loading && <LoadingSpinner />}

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

      {projectId && (
        <FunctionDialog
          open={dialogOpen}
          projectId={projectId}
          func={selectedFunction}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </>
  )
}
