import type { Function as TDFunction } from '@tdsk/domain'
import { useEffect, useState, useMemo } from 'react'
import { useFunctions } from '@TAF/state/selectors'
import { NoFunctions } from './NoFunctions'
import { FunctionsGrid } from './FunctionsGrid'
import { fetchFunctions, deleteFunction } from '@TAF/actions/functions'
import { FunctionDialog } from './FunctionDialog'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
import {
  SearchBar,
  FilterSelect,
  PageHeader,
  EmptyState,
  LoadingSpinner,
} from '@TAF/components'
import { Add as AddIcon } from '@mui/icons-material'
import { Box } from '@mui/material'

export type TFunctions = {
  projectId: string
  orgId?: string
}

export const Functions = ({ projectId, orgId }: TFunctions) => {
  const [functions] = useFunctions()
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
