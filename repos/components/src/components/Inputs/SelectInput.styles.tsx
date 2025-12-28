import { gutter } from '@TSC/theme/gutter'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import MSelect from '@mui/material/Select'
import { styled } from '@mui/material/styles'
import MMenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox/Checkbox'


export const SelectItemInput = styled(MSelect)(({ theme }) => {
  return `
    background-color: ${theme.palette.background.input};
    border-radius: 1;
    &.MuiOutlinedInput-root {
      & fieldset {
        border: 1px solid ${theme.palette.border.default};
      }
    }
  `
})

export const SelectMenuItem = styled(MMenuItem)(({ theme }) => {
  return `
    &.multiple {
      margin-top: ${gutter.qpx};
    }
  `
})

export const SelectItemStack = styled(Stack)(({ theme }) => {
  return `
    &.spacer {
      margin-bottom: ${gutter.qpx};
    }
  `
})

export const SelectItemText = styled(Box)(({ theme }) => {
  return `
    .prefix {
      margin-left: ${gutter.qpx};
    }

    .postfix {
      margin-left: ${gutter.qpx};
    }
    
    &.inline-text {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      & > label {
      }
      & > p {
        margin-left: ${gutter.qpx};
        &:before {
          content: " - "
        }
        overflow: hidden;
        width: 70%;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  `
})

export const SelectItemCheck = styled(Checkbox)(({ theme }) => {
  return `
    width: ${gutter.px};
    height: ${gutter.px};
  `
})
