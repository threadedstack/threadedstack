import type { SxProps, Theme } from '@mui/material'

import { InputAdornment, IconButton } from '@mui/material'
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material'
import { TextInput } from '@tdsk/components'

export type TSearchBar = {
  id?: string
  value: string
  disabled?: boolean
  autoFocus?: boolean
  fullWidth?: boolean
  sx?: SxProps<Theme>
  placeholder?: string
  size?: 'small' | 'medium'
  onBlur?: (value: string) => void
  onChange: (value: string) => void
}

export const SearchBar = (props: TSearchBar) => {
  const {
    sx,
    value,
    onBlur,
    onChange,
    size = 'small',
    disabled = false,
    fullWidth = true,
    autoFocus = false,
    placeholder = 'Search...',
    id = `tdsk-search-component`,
  } = props

  return (
    <TextInput
      id={id}
      sx={{ bgcolor: 'background.paper', ...sx }}
      size={size}
      value={value}
      disabled={disabled}
      autoFocus={autoFocus}
      fullWidth={fullWidth}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur ? (e) => onBlur?.(e.target.value) : undefined}
      startAdornment={
        <InputAdornment
          position='start'
          sx={{ pl: 1 }}
        >
          <SearchIcon color='action' />
        </InputAdornment>
      }
      endAdornment={
        value ? (
          <InputAdornment position='end'>
            <IconButton
              edge='end'
              size='small'
              disabled={disabled}
              aria-label='Clear search'
              onClick={() => onChange('')}
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null
      }
    />
  )
}

export default SearchBar
