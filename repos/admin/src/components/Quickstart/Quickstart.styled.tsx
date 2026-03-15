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
    width: 28,
    height: 28,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
    borderRadius: theme.spacing(0.75),
    backgroundColor: alpha(c, 0.1),
    color: c,
    flexShrink: 0,
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
