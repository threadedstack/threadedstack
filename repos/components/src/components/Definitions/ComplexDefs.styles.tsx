import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'

import { grey } from '@TSC/theme/colors'
import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import { Text, Label } from '@TSC/components/Text'
import { LoadingButton } from '@TSC/components/Buttons'
import { TextInput } from '@TSC/components/Inputs/TextInput'
import { Accordion } from '@TSC/components/Accordion/Accordion'

export const CDAccordion = styled(Accordion)(({ theme }) => {
  return `
    min-width: 40vw;
    border-bottom: none;
    border-radius: ${dims.border.tpx};
    
    &.MuiAccordion-root {
      border-radius: ${dims.border.tpx};
    }

    & .MuiAccordion-heading .MuiAccordionSummary-root {
      padding: ${gutter.hpx} ${gutter.px};
      border-top-left-radius: ${dims.border.tpx};
      border-top-right-radius: ${dims.border.tpx};
    }
    
    & .MuiAccordionDetails-root {
      max-height: 50vh;
      overflow-y: scroll;
    }
    
  `
})

export const DefFiltersBox = styled(Box)`
  top: 0px;
  z-index: 10;
  position: sticky;
  box-sizing: border-box;
`

export const DefFiltersContainer = styled(Box)(
  ({ theme }) => `
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: start;
  box-sizing: border-box;
  padding: ${gutter.qpx} ${gutter.px} ${gutter.tpx};
  background-color: ${theme.palette.background.default};
  border-bottom: 1px solid ${theme.palette.border.default};
`
)

export const DefSearchBox = styled(Box)`
  width: 100%;
  display: flex;
  align-items: center;
`

export const DefSearchInput = styled(TextInput)`
  width: 100%;
  
  & input {
    width: calc( 100% - 75px);
  }

`

export const DefSearchBtn = styled(LoadingButton)`
  min-width: 45px;
  margin-top: 4px;
  position: absolute;
  align-items: center;
  padding: ${gutter.qpx};
  right: ${gutter.size + 1}px;
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
  height: ${dims.form.input.height - 2}px;
  
  & .MuiButton-startIcon {
    margin-right: initial;
    margin-left: initial;
  }
`

export const DefGroupBox = styled(Box)(
  ({ theme }) => `
  margin: ${gutter.px} ${gutter.hpx};
  border-radius: ${dims.border.ipx};
  border: 1px solid ${theme.palette.border.muted};
`
)

export const DefGroupHeader = styled(Box)(
  ({ theme }) => `
  display: flex;
  align-items: center;
  padding: ${gutter.qpx} ${gutter.hpx};
  border-top-left-radius: ${dims.border.ipx};
  border-top-right-radius: ${dims.border.ipx};
  background-color: ${theme.palette.background.header};
`
)

export const DefGroupTitle = styled(Label)(({ theme }) => {
  return `
    font-size: 12px;
    font-weight: 600;
    padding: 0px ${gutter.hpx};
    text-transform: capitalize;
    color: ${theme.palette.secondary.contrastText};
  `
})
