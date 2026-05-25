import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import DialogContent from '@mui/material/DialogContent'

export const WizardDialogContent = styled(DialogContent)({
  padding: 0,
  display: `flex`,
  height: `100%`,
})

export const WizardContainer = styled(Box)({
  height: `100%`,
  width: `100%`,
  display: `flex`,
  overflow: `hidden`,
})

export const StepperPanel = styled(Box)(({ theme }) => ({
  width: 220,
  flexShrink: 0,
  display: `flex`,
  flexDirection: `column`,
  padding: theme.spacing(3, 2),
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
}))

export const ContentPanel = styled(Box)({
  flex: 1,
  display: `flex`,
  overflow: `hidden`,
  flexDirection: `column`,
})

export const ContentBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: `auto`,
  padding: theme.spacing(3),
}))

export const ContentFooter = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  padding: theme.spacing(2, 3),
  justifyContent: `space-between`,
  borderTop: `1px solid ${theme.palette.divider}`,
}))

export const ResourceChoiceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== `selected`,
})<{ selected?: boolean }>(({ theme, selected }) => ({
  cursor: `pointer`,
  transition: `all 0.2s`,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  backgroundColor: selected ? theme.palette.action.selected : `transparent`,
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}))

export const SkipWarning = styled(Box)(({ theme }) => ({
  display: `flex`,
  gap: theme.spacing(1),
  alignItems: `flex-start`,
  marginTop: theme.spacing(1),
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.warning.main + `14`,
  border: `1px solid ${theme.palette.warning.main}33`,
}))
