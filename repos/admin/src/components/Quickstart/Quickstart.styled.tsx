import { styled, alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'

export const SectionHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}))

export const SectionIcon = styled(Box, {
  shouldForwardProp: (p) => p !== `color`,
})<{ color?: string }>(({ theme, color }) => {
  const c = color || theme.palette.primary.main
  return {
    color: c,
    width: 28,
    height: 28,
    flexShrink: 0,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    backgroundColor: alpha(c, 0.1),
    borderRadius: theme.spacing(0.75),
  }
})

export const FormSection = styled(Box)(({ theme }) => ({
  display: `flex`,
  flexDirection: `column`,
  gap: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}))
