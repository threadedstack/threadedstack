import type { TButton } from '@TSC/components/Buttons/Button'

import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'
import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import { Text } from '@TSC/components/Text/Text'
import { Image } from '@TSC/components/Image/Image'
import { Button } from '@TSC/components/Buttons/Button'

// TODO: grid-template-columns should change based on screen-size
export const DefsContainer = styled(Box)`
  display: grid;
  max-height: 40vh;
  overflow-x: hidden; 
  padding: ${gutter.hpx};
  grid-template-columns: repeat(6, 1fr);
`

export const DefContainer = styled(Box)`
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${gutter.qpx};
  border-radius: ${dims.border.tpx};
`

type TDefButton = TButton & {
  iconColor?: string
}

export const DefButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== `iconColor`,
})<TDefButton>(({ theme, iconColor }) => {
  return `
    width: 80px;
    height: 80px;
    max-width: 80px;
    opacity: 0.5;
    flex-grow: 1;
    display: flex;
    align-items: center;
    flex-direction: column;
    border: 2px solid transparent;
    fill: ${theme.palette.text.primary};
    color: ${theme.palette.text.primary};
    transition: color 0.4s ease, fill 0.4s ease, border 0.4s ease, opacity 0.4s ease;
    &:hover {
      opacity: 1;
      fill: ${iconColor || theme.palette.primary.main};
      color: ${iconColor || theme.palette.primary.main};
      border: 2px solid ${iconColor || theme.palette.primary.main};
    }

    &.disabled {
      cursor: not-allowed;
      opacity: 0.3 !important;
      border: 2px solid transparent !important;
      fill: ${theme.palette.text.primary} !important;
      color: ${theme.palette.text.primary} !important;
    }
  `
})

export const DefText = styled(Text)`
  color: inherit;
  font-size: 12px;
  line-height: 1.2;
  margin-top: ${gutter.hpx};
`

export const DefIconContainer = styled(Box)(({ theme }) => {
  return `
    width: 30px;
    height: 30px;
  `
})

export const DefIconImage = styled(Image)(({ theme }) => {
  return `
    width: 30px;
    height: 30px;
    border-radius: ${dims.border.tpx};
  `
})
