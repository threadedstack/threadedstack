import Box from '@mui/material/Box'
import MMenu from '@mui/material/Menu'
import { dims } from '@TSC/theme/dims'
import { gutter } from '@TSC/theme/gutter'
import { colors } from '@TSC/theme/colors'
import { Text } from '@TSC/components/Text'
import { styled } from '@mui/material/styles'
import ListIcon from '@mui/icons-material/List'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import ListItemIcon from '@mui/material/ListItemIcon'
import { Button } from '@TSC/components/Buttons/Button'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem, { type MenuItemProps } from '@mui/material/MenuItem'

export const MuiMenu = styled(MMenu)`

  & .MuiMenu-paper {
    min-width: 400px;
  }


  & .MuiList-root {
    padding: 0px;
    padding-top: 0px;
    padding-bottom: 0px;
  }

  & hr {
    margin: 0px !important;
  }
`

export const MenuItemsContainer = styled(Box)`
  padding: ${gutter.hpx} 0px;
`

export const MuiMenuItem = TooltipHoc<MenuItemProps, HTMLLIElement>(styled(MenuItem)`
  padding: ${gutter.hpx} ${gutter.px};
  
  & .tdsk-menu-item-label .MuiTypography-root {
    font-size: 14px;
    line-height: 14px;
  }
  
`)

export const MenuHeaderContainer = styled(Box)(({ theme }) => {
  return `
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: start;
    box-sizing: border-box;
    padding: 0px ${gutter.tpx};
    height: ${dims.dropdown.header.px};
    min-height: ${dims.dropdown.header.px};
    background-color: ${theme.palette.background.input};
    border-bottom: 1px solid ${theme.palette.border.default};
  `
})

export const MenuHeaderTitle = styled(Text)`
  flex-grow: 1;
  display: flex;
  font-size: 14px;
  font-weight: bold;
  align-items: center;
  color: currentColor;
`

export const MenuHeaderIconContainer = styled(Box)(({ theme }) => {
  const isDark = theme.palette.mode === `dark`
  const color = isDark ? colors.primary[600] : colors.primary[500]

  return `
    height: 23px;
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

export const MenuHeaderIcon = styled(ListIcon)`
`

export const MenuItemIconContainer = styled(ListItemIcon)`
  min-height: 24px;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`

export const LoadingIcon = styled(CircularProgress)`
  margin-left: ${gutter.px};
`

export const MenuBackContainer = styled(Box)(({ theme }) => {
  return `
    display: flex;
    align-items: center;
    box-sizing: border-box;
    justify-content: space-between;
    padding: ${gutter.qpx} ${gutter.hpx};
    padding-right: ${gutter.px};
    border-bottom: 1px solid ${theme.palette.border.default};
  `
})

export const MenuBackButton = styled(Button)``

export const MenuBackText = styled(Text)`
  font-size: 12px;
  text-overflow: ellipsis;
  margin-left: ${gutter.hpx};
`
