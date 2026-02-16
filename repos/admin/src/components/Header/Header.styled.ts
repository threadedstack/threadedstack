import Box from '@mui/material/Box'
import MuiMenu from '@mui/material/Menu'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import { styled } from '@mui/material/styles'
import MuiIconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { dims, gutter, IconButton } from '@tdsk/components'

export const AppHeader = styled(AppBar)(({ theme }) => {
  return `
    z-index: 1200;
    padding-left: 0;
    box-shadow: none;
    border-radius: 0px;
    padding: 0 ${gutter.hpx};
    height: ${dims.header.hpx};
    border-bottom: 1px solid ${theme.palette.divider};
    background-color: ${theme.palette.background.header};
    
    & .MuiToolbar-root {
      min-height: ${dims.header.hpx};
    }
  `
})

export const HeaderToolbar = styled(Toolbar)(({ theme }) => {
  return `
    padding-left: 0px !important;
    padding-right: 0px !important;
    height: ${dims.header.hpx};
  `
})

export const Menu = styled(MuiMenu)(({ theme }) => {
  return `
    & .MuiPaper-root {
      min-width: 200px;
      box-shadow: ${theme.palette.colors.shadowAlt};
      border: 1px solid ${theme.palette.border.section};
    }
  `
})

export const LogoContainer = styled(Box)`
  display: flex;
  align-items: center;
`
export const LogoBtn = styled(MuiIconButton)`
  padding: 2px;
  display: flex;
  margin: 0px 6px;
  position: relative;
  border-radius: 6px;
  align-items: center;
`

export const LogoText = styled(Typography)(
  ({ theme }) => `
  left: 100%;
  font-size: 18px;
  margin-left: 6px;
  margin-right: 6px;
  letter-spacing: -1px;
  color: ${theme.palette.text.primary};
`
) as typeof Typography

export const ToggleBinBAction = styled(IconButton)`
  margin-right: ${gutter.qpx};
`

export const ToggleThemeAction = styled(IconButton)`
  margin-right: ${gutter.hpx};
`
