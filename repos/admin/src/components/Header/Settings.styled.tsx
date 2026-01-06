import Box from '@mui/material/Box'
import { gutter } from '@tdsk/components'
import { styled } from '@mui/material/styles'

export const SettingsContainer = styled(Box)(
  ({ theme }) => `
  flex-grow: 0;
  padding-left: ${gutter.px};
`
)
