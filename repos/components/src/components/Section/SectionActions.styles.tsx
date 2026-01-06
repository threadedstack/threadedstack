import { gutter } from '@TSC/theme'
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { Button } from '@TSC/components/Buttons/Button'
import { IconButton } from '@TSC/components/Buttons/IconButton'

export const SectionActionSep = styled(Box)(({ theme }) => {
  return `
    min-width: 1px;
    min-height: ${gutter.mpx};
    max-height: ${gutter.mpx};

    &.separator-before {
      margin-left: ${gutter.hpx};
      padding-left: ${gutter.qpx};
      border-left: 1px solid ${theme.palette.border.default};
    }

    &.separator-after {
      margin-right: ${gutter.hpx};
      padding-right: ${gutter.qpx};
      border-right: 1px solid ${theme.palette.border.default};
    }
  `
})

export const SectionActionsContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
  `
})

export const SectionActionContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
  `
})

export const SectionActionIconButton = styled(IconButton)(({ theme }) => {
  return `
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }

    &.active {
      opacity: 1;
    }

  `
})

export const SectionActionButton = styled(Button)(({ theme }) => {
  return `
    display: flex;
    font-size: 10px;
    flex-direction: column;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }

    &.active {
      opacity: 1;
    }

  `
})
