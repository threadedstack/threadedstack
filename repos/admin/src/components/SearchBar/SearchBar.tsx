import type { SxProps, Theme } from '@mui/material'

import { TextField, InputAdornment, IconButton } from '@mui/material'
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material'

export type TSearchBar = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  fullWidth?: boolean
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
  disabled?: boolean
  autoFocus?: boolean
}

export const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search...',
  fullWidth = true,
  size = 'small',
  sx,
  disabled = false,
  autoFocus = false,
}: TSearchBar) => {
  return (
    <TextField
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      autoFocus={autoFocus}
      sx={sx}
      InputProps={{
        startAdornment: (
          <InputAdornment position='start'>
            <SearchIcon color='action' />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position='end'>
            <IconButton
              size='small'
              onClick={() => onChange('')}
              edge='end'
              disabled={disabled}
              aria-label='Clear search'
            >
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  )
}

export default SearchBar
