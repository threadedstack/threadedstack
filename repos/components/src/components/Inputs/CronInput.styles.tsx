import Box from '@mui/material/Box'
import { gutter } from '@TSC/theme/gutter'
import { styled } from '@mui/material/styles'
import {
  ButtonGroup,
  GroupButton
} from '@TSC/components/Buttons/ButtonGroup'


export const CronContainer = styled(Box)`
  display: flex;
  gap: ${gutter.mpx};
  flex-direction: column;
`

export const DayButtonGroup = styled(ButtonGroup)`
  width: 100%;
  & > * {
    width: 100%;
  }
`

export const DayButton = styled(GroupButton)`
`

export const CronInputsRow = styled(Box)`
  flex: 1;
  width: 100%;
  display: flex;
  gap: ${gutter.hpx};
  align-items: center;
  justify-content: flex-start;
  
  & > * {
    width: 100%;
  }
  
`

