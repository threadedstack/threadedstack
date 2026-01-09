import { FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TFilterOption = {
  value: string
  label: string
}

export type TFilterSelect = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: TFilterOption[]
  allLabel?: string
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
  disabled?: boolean
  minWidth?: number
}

export const FilterSelect = ({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
  size = 'small',
  sx,
  disabled = false,
  minWidth = 120,
}: TFilterSelect) => {
  return (
    <FormControl
      size={size}
      sx={{ minWidth, ...sx }}
      disabled={disabled}
    >
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value='all'>{allLabel}</MenuItem>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}

export default FilterSelect
