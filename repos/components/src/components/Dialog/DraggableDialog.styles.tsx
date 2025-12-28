import { IconButton } from '@TSC/components/Buttons/IconButton'
import { colors, grey } from '@TSC/theme/colors'
import { dims } from '@TSC/theme/dims'
import { gutter } from '@TSC/theme/gutter'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

export const DDialog = styled(Dialog)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const bgclr = isDark ? grey[900] : colors.white

  return `
  
    & .MuiPaper-root {
      max-height: calc(100vh - ${dims.modal.tabs.height + gutter.d}px);
    }

    & .MuiDialogContent-root {
      padding: ${gutter.dpx};
      background-color: ${bgclr};
      padding-bottom: ${gutter.px};
    }
  `
})

export const DDPaper = styled(Paper)(({ theme }) => {
  return `
    position: relative;
    pointer-events: auto;
  `
})

export const DDHeader = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const bdClr = isDark ? grey[900] : grey[100]

  return `
    cursor: grab;
    display: flex;
    position: relative;
    overflow-x: hidden;
    align-items: center;
    justify-content: flex-start;
    border-bottom: 1px solid ${bdClr};
    min-height: ${dims.modal.tabs.hpx};
    background-color: ${isDark ? grey[875] : grey[50]};
  `
})

export const DDTitle = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`

  return `
    flex-grow: 2;
    display: flex;
    font-weight: bold;
    align-items: center;
    background-color: ${isDark ? grey[875] : grey[50]};
    border-bottom: 1px solid ${theme.palette.border.default};
    & .tdsk-dialog-title-icon {
      display: inline-flex;
      svg {
        margin-right: ${gutter.hpx};
      }
    }
  `
})

export const DDTitleClose = styled(IconButton)(({ theme }) => {
  return `
    flex-shrink: 1;
    padding-left: ${gutter.hpx};
    padding-right: ${gutter.hpx};
  `
})

export const DDCloseIcon = styled(CloseIcon)`
  width: ${gutter.px};
  height: ${gutter.px};
`

export const DDDragBox = styled(Box)(({ theme }) => {
  return `
    cursor: grab;
    background: transparent;
    padding-left: ${gutter.hpx};
    padding-right: ${gutter.hpx};
    flex-shrink: 1;
  `
})

export const DDDragIcon = styled(DragIndicatorIcon)`
  width: ${gutter.rpx};
  height: ${gutter.rpx};
`
