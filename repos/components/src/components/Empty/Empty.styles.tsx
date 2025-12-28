import Box from '@mui/material/Box'
import styled from '@mui/material/styles/styled'
import BlockIcon from '@mui/icons-material/Block'
import { colors, grey, gutter } from '@TSC/theme'

export const EmptyContainer = styled(Box)`
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  margin-top: ${gutter.px};
  margin-bottom: ${gutter.mpx};
  padding: ${gutter.px} ${gutter.dpx};
`
export const EmptyTitle = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? grey[600] : grey[400]
  return `
    display: flex;
    color: ${color};
    font-size: 18px;
    font-weight: bold;
    align-items: center;
    justify-content: center;
    margin-top ${gutter.dpx};
    padding: ${gutter.hpx} ${gutter.px} 0px;
  `
})

export const EmptyContent = styled(Box)(({ theme }) => {
  return `
    display: flex;
    max-width: 80%;
    text-align: center;
    align-items: center;
    padding: ${gutter.px};
    flex-direction: column;
    justify-content: center;
  `
})

export const EmptyIcon = styled(BlockIcon)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? colors.primary[900] : colors.primary[200]

  return `
    color: ${color};
    width: ${gutter.mpx};
    height: ${gutter.mpx};
    margin-right: ${gutter.hpx};
  `
})

export const EmptyText = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? grey[600] : grey[400]

  return `
    font-size: 14px;
    color: ${color};
  `
})
