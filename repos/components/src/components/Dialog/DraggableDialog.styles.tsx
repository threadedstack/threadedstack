import { IconButton } from '@TSC/components/Buttons/IconButton'

import { dims } from '@TSC/theme/dims'
import { gutter } from '@TSC/theme/gutter'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import Paper from '@mui/material/Paper'
import { styled } from '@mui/material/styles'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'

export const DDialog = styled(Dialog)(({ theme }) => {
  return `

    & .MuiPaper-root {
      max-height: calc(100vh - ${dims.modal.tabs.height + gutter.d}px);
    }

    & .MuiDialogContent-root {
      padding: ${gutter.dpx};
      background-color: ${theme.palette.background.default};
      padding-bottom: ${gutter.px};
    }
  `
})

export const DDPaper = styled(Paper)`
  position: relative;
  pointer-events: auto;
`

export const DDHeader = styled(Box)(({ theme }) => {
  return `
    cursor: grab;
    display: flex;
    position: relative;
    overflow-x: hidden;
    align-items: center;
    justify-content: flex-start;
    border-bottom: 1px solid ${theme.palette.border.default};
    min-height: ${dims.modal.tabs.hpx};
    background-color: ${theme.palette.background.header};
  `
})

export const DDTitle = styled(Box)(({ theme }) => {
  return `
    flex-grow: 2;
    display: flex;
    font-weight: bold;
    align-items: center;
    background-color: ${theme.palette.background.header};
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
    flex-shrink: 1;
    background: transparent;
    padding-left: ${theme.gutter.hpx};
    padding-right: ${theme.gutter.hpx};
  `
})

export const DDDragIcon = styled(DragIndicatorIcon)`
  width: ${gutter.rpx};
  height: ${gutter.rpx};
`
