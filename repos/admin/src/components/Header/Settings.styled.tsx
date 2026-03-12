import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export const SettingsContainer = styled(Box)(
  ({ theme }) => `
  flex-grow: 0;
  padding-left: ${theme.gutter.px};
`
)
