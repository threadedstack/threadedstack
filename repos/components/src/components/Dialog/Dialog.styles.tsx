import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import SaveIcon from '@mui/icons-material/Save'
import MCancelIcon from '@mui/icons-material/Cancel'
import MDialogActions from '@mui/material/DialogActions'
import MDialogContent from '@mui/material/DialogContent'
import MDialogTitle from '@mui/material/DialogTitle'

export const DialogContent = styled(MDialogContent)(({ theme }) => {
  return `
    position: relative;
    padding: ${gutter.mpx};
    padding-top: ${gutter.px};
    padding-bottom: ${gutter.hpx};
    background-color: ${theme.palette.background.section};
  `
})

export const DialogTitle = styled(MDialogTitle)(({ theme }) => {
  return `
    display: flex;
    font-weight: bold;
    align-items: center;
    background-color: ${theme.palette.background.muted};
    border-bottom: 1px solid ${theme.palette.border.default};
    & .tdsk-dialog-title-icon {
      display: inline-flex;
      svg {
        margin-right: ${gutter.hpx};
      }
    }
  `
})

export const DialogActions = styled(MDialogActions)(({ theme }) => {
  return `
    position: sticky; 
    bottom: 0;
    padding: ${gutter.px};
    background-color: ${theme.palette.background.muted};
    border-top: 1px solid ${theme.palette.border.default};
  `
})

export const ConfirmIcon = styled(SaveIcon)`
  width: ${gutter.px};
  height: ${gutter.px};
`

export const CancelIcon = styled(MCancelIcon)`
  width: ${gutter.px};
  height: ${gutter.px};
`
