import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import { Add as AddIcon } from '@mui/icons-material'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { PageHeader } from '@TAF/components/PageHeader/PageHeader'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { FilterSelect } from '@TAF/components/FilterSelect/FilterSelect'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'

export type TFilterOpts = {
  value: string
  label: string
}[]

export type TPageLayout = {
  title?: string
  count?: number
  query?: string
  error?: string
  loading?: boolean
  divider?: boolean
  countLabel?: string
  filterLabel?: string
  filterValue?: string
  searchCount?: number
  children?: ReactNode
  actionIcon?: ReactNode
  filterAllLabel?: string
  actionLabel?: ReactNode
  filterOpts?: TFilterOpts
  searchPlaceholder?: string
  onAction?: (_?: any) => void
  setError?: (err: string) => void
  onFilter?: (value: string) => void
  setSearchQuery?: (query: string) => void
}

const styles = {
  search: {
    filter: {
      mb: 3,
      gap: 2,
      display: 'flex',
      flexWrap: 'wrap',
    },
    default: {
      mb: 3,
    },
  },
}

export const PageLayout = (props: TPageLayout) => {
  const {
    title,
    count,
    query,
    error,
    loading,
    setError,
    onAction,
    children,
    onFilter,
    countLabel,
    actionLabel,
    filterOpts,
    filterLabel,
    filterValue,
    divider = true,
    searchCount = 0,
    filterAllLabel,
    setSearchQuery,
    searchPlaceholder,
    actionIcon = <AddIcon />,
  } = props

  return (
    <>
      <PageHeader
        title={title}
        count={count}
        onAction={onAction}
        countLabel={countLabel}
        actionIcon={actionIcon}
        actionLabel={actionLabel}
      />

      {!loading && setSearchQuery && count > searchCount && (
        <Box sx={onFilter ? styles.search.filter : styles.search.default}>
          <SearchBar
            value={query}
            onChange={setSearchQuery}
            placeholder={searchPlaceholder}
          />
          {onFilter && (
            <FilterSelect
              id='page-filter'
              value={filterValue}
              onChange={onFilter}
              label={filterLabel}
              allLabel={filterAllLabel}
              options={filterOpts || []}
            />
          )}
        </Box>
      )}

      {error && (
        <ErrorAlert
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
          message={`[Error] ${error}`}
        />
      )}

      {divider && (
        <Box sx={{ display: `flex`, flex: 1, pt: 1, pb: 4 }}>
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      {loading ? <LoadingSpinner /> : children}
    </>
  )
}
