import { ToggleButton, ToggleButtonGroup } from '@mui/material'

export type TViewMode = 'gui' | 'terminal'

export type TViewToggleProps = {
  value: TViewMode
  onChange: (mode: TViewMode) => void
}

export const ViewToggle = (props: TViewToggleProps) => {
  const { value, onChange } = props

  const handleChange = (
    _evt: React.MouseEvent<HTMLElement>,
    newValue: TViewMode | null
  ) => {
    if (newValue !== null) onChange(newValue)
  }

  return (
    <ToggleButtonGroup
      exclusive
      size='small'
      value={value}
      onChange={handleChange}
      sx={{
        '& .MuiToggleButton-root': {
          py: 0.25,
          px: 1.25,
          textTransform: `none`,
          fontSize: `0.75rem`,
        },
      }}
    >
      <ToggleButton value='gui'>GUI</ToggleButton>
      <ToggleButton value='terminal'>Terminal</ToggleButton>
    </ToggleButtonGroup>
  )
}
