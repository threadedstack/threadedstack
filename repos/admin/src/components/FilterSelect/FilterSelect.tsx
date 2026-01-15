import type { SxProps, Theme } from '@mui/material'
import { SelectInput } from '@tdsk/components'

export type TFilterOption = {
  value: string
  label: string
}

export type TFilterSelect = {
  id: string
  value: string
  label?: string
  hidden?: boolean
  allLabel?: string
  disabled?: boolean
  sx?: SxProps<Theme>
  options: TFilterOption[]
  size?: 'small' | 'medium'
  onChange: (value: string) => void
}

export const FilterSelect = ({
  id,
  sx,
  label,
  value,
  hidden,
  options,
  onChange,
  size = 'small',
  allLabel = 'All',
  disabled = false,
}: TFilterSelect) => {
  const items = [{ value: 'all', label: allLabel }, ...options]

  return (
    <SelectInput
      sx={sx}
      id={id}
      size={size}
      items={items}
      label={label}
      value={value}
      hidden={hidden}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export default FilterSelect
