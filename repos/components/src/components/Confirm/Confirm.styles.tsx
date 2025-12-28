import Dialog from '@mui/material/Dialog'
import { gutter } from '@TSC/theme/gutter'
import { colors } from '@TSC/theme/colors'
import styled from '@mui/material/styles/styled'
import ErrorIcon from '@mui/icons-material/Error'
import DialogTitle from '@mui/material/DialogTitle'
import { Button } from '@TSC/components/Buttons/Button'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

export const ConfirmDialog = styled(Dialog)`
  background-image: none;
`

export const ConfirmDialogActions = styled(DialogActions)(({ theme }) => {
  return `
    padding: ${gutter.px};
    justify-content: space-between;
    background-color: ${theme.palette.background.input};
    border-top: 1px solid ${theme.palette.border.default};
  `
})

export const ConfirmCancelBtn = styled(Button)``

export const ConfirmContent = styled(DialogContent)`
  display: flex;
  min-height: 100px;
  align-items: start;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
`

export const ConfirmHeaderIcon = styled(ErrorIcon)(({ theme }) => {
  return `
    width: 28px;
    height: 28px;
    margin-right: ${gutter.hpx};
    fill: ${colors.states.danger};
  `
})

export const ConfirmTitle = styled(DialogTitle)(({ theme }) => {
  return `
    display: flex;
    align-items: center; 
    background-color: ${theme.palette.background.input};
    border-bottom: 1px solid ${theme.palette.border.default};
  `
})
