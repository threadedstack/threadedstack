import Box from '@mui/material/Box'
import { gutter } from '@TSC/theme'
import { styled } from '@mui/material/styles'
import { colors, grey } from '@TSC/theme/colors'

export const DDHeaderContainer = styled(Box)`
  width: 100%;
  padding: ${gutter.hpx};
`

export const DDHeaderContent = styled(Box)`
  display: flex;
  flex-direction: row;
  align-items: center;
`

export const DDHeaderIcon = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? colors.primary[600] : colors.primary[500]

  return `
    display: flex;
    color: ${color};
    margin-right: ${gutter.qpx};
  `
})

export const DDHeaderText = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? grey[200] : grey[800]

  return `
    color: ${color};
    display: block;
    font-size: 14px;
    line-height: 1.6;
    font-weight: bold;
    margin-bottom: 0px;
  `
})
