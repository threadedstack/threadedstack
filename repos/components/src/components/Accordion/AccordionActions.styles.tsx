import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import { tooltipClasses } from '@mui/material/Tooltip'
import { Button } from '@TSC/components/Buttons/Button'
import { InfoTip } from '@TSC/components/InfoTip/InfoTip'
import { IconButton } from '@TSC/components/Buttons/IconButton'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import { gutter } from '@TSC/theme'

export const AccordionActionSep = styled(Box)(({ theme }) => {
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

export const AccordionInfoIcon = styled(HelpOutlineOutlinedIcon)`
  width: ${gutter.px};
  height: ${gutter.px};
`

export const AccordionActionsContainer = styled(Box)(({ theme }) => {
  return `
    opacity: 0;
    display: flex;
    pointer-events: none;
    transition: opacity 0.4s ease;

    &.show {
      opacity: 1;
      pointer-events: inherit;
    }

  `
})

export const AccordionActionContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
  `
})

export const AccordionActionIconButton = styled(IconButton)(({ theme }) => {
  return ``
})

export const AccordionActionButton = styled(Button)(({ theme }) => {
  return `
    display: flex;
    font-size: 10px;
    flex-direction: column;
  `
})

export const AccordionInfoTip = styled(InfoTip)(({ theme }) => {
  return `
    background-color: transparent;
    & .${tooltipClasses.tooltip} {
      padding: ${gutter.px};
      color: ${theme.palette.text.primary};
      font-size: ${theme.typography.pxToRem(14)};
      background-color: ${theme.palette.background.paper};
    }
  `
})

export const AccordionInfoContainer = styled(Box)(({ theme }) => {
  return ``
})
