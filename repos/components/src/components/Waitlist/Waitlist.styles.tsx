import Box from '@mui/material/Box'
import { gutter } from '@TSC/theme/gutter'
import { Text } from '@TSC/components/Text/Text'
import { styled, alpha } from '@mui/material/styles'

export const WaitlistCard = styled(Box)(({ theme }) => {
  return `
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    margin-bottom: ${gutter.mpx};
    padding: ${gutter.mpx} ${gutter.dpx};
    border: 1px solid ${theme.palette.divider};
    border-radius: ${theme.dims?.border?.smpx || '8px'};
    background: ${alpha(theme.palette.text.primary, 0.02)};
  `
})

export const WaitlistMessage = styled(Text)(({ theme }) => {
  return `
    font-weight: 400;
    line-height: 1.6;
    text-align: center;
    font-size: 0.875rem;
    color: ${theme.palette.text.secondary};
  `
})
