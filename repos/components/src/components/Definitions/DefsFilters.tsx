import SearchIcon from '@mui/icons-material/Search'
import { useKeyDown } from '@TSC/hooks/dom/useKeyDown'
import {
  DefSearchBox,
  DefSearchBtn,
  DefFiltersBox,
  DefSearchInput,
  DefFiltersContainer,
} from '@TSC/components/Definitions/ComplexDefs.styles'

export type TDefsFilters = {
  search?: string
  loading?: boolean
  onSearchClick?: (evt: any) => any
  onSearchChange?: (evt: any) => any
}

export const DefsFilters = (props: TDefsFilters) => {
  const { search, loading, onSearchClick, onSearchChange } = props

  const { onKeyDown } = useKeyDown({
    stopEvt: true,
    onEnterDown: onSearchClick,
  })

  return (
    <DefFiltersBox className='tdsk-def-filters-box'>
      <DefFiltersContainer className='tdsk-def-filters-container'>
        <DefSearchBox className='tdsk-def-search-box'>
          <DefSearchInput
            value={search}
            disabled={loading}
            onKeyDown={onKeyDown}
            id='tdsk-defs-search'
            name='tdsk-defs-search'
            onChange={onSearchChange}
            placeholder='Search definitions...'
          />
          <DefSearchBtn
            loading={loading}
            Icon={SearchIcon}
            variant='contained'
            onClick={onSearchClick}
            className='tdsk-def-search-button'
          />
        </DefSearchBox>
      </DefFiltersContainer>
    </DefFiltersBox>
  )
}
