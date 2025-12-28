import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import { dims } from '@TSC/theme/dims'
import Stack from '@mui/material/Stack'
import { gutter } from '@TSC/theme/gutter'
import { colors } from '@TSC/theme/colors'
import { styled } from '@mui/material/styles'

export const SectionContainer = styled(Paper)(({ theme }) => {
  return `
    &.MuiPaper-rounded {
      border-radius: ${dims.border.tpx};
      
      & .tdsk-section-header {
        border-top-left-radius: ${dims.border.tpx};
        border-top-right-radius: ${dims.border.tpx};
      }

      & .tdsk-section-footer {
        border-bottom-left-radius: ${dims.border.tpx};
        border-bottom-right-radius: ${dims.border.tpx};
      }

    }
  `
})

export const SectionStack = styled(Stack)``

export const SectionHeader = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100%;
    display: flex;
    max-height: ${dims.dropdown.header.px};
    background-color: ${theme.palette.background.input};
  `
})



export const SectionHeaderContainer = styled(Box)`
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: start;
  padding: 0px ${gutter.px};
  height: ${dims.dropdown.header.px};
  min-height: ${dims.dropdown.header.px};
`

export const SectionHeaderIconContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? colors.primary[600] : colors.primary[500]

  return `
    height: 24px;
    width: 24px;
    color: ${color};
    margin-right: ${gutter.hpx};
    & svg {
      width: 24px;
      height: 24px;
      color: currentColor;
    }
  `
})


export const SectionHeaderText = styled(Box)`
  flex-grow: 1;
  display: flex;
  font-size: 14px;
  font-weight: bold;
  align-items: center;
  color: currentColor;
`

export const SectionContent = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: start;
    border-top: 1px solid ${theme.palette.border.default};
  `
})