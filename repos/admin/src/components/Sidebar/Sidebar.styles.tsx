import { styled } from '@mui/material'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import Typography from '@mui/material/Typography'
import MuiIconButton from '@mui/material/IconButton'
import { SidebarWidthOpen, SidebarWidthClosed } from '@TAF/constants/values'
import {
  cmx,
  dims,
  Text,
  List,
  colors,
  gutter,
  ListItem,
  IconButton,
} from '@tdsk/components'

export const SideDrawer = styled(Drawer, { shouldForwardProp: (prop) => prop !== `open` })(
  ({ theme, open }) => ({
    [`& .MuiDrawer-paper`]: {
      position: `relative`,
      whiteSpace: `nowrap`,
      backgroundColor: theme.palette.background.section,
      width: SidebarWidthOpen,
      transition: theme.transitions.create(`width`, {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
      }),
      boxSizing: `border-box`,
      ...(!open && {
        overflowX: `hidden`,
        transition: theme.transitions.create(`width`, {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
        width: SidebarWidthClosed,
      }),
    },
  }),
)


export const LogoContainer = styled(Box)`
  display: flex;
  align-items: center;
`
export const LogoBtn = styled(MuiIconButton)`
  padding: 2px;
  display: flex;
  margin: 0px 6px;
  position: relative;
  border-radius: 0px;
  align-items: center;
`

export const LogoText = styled(Text)(({ theme }) => `
  left: 100%;
  font-size: 18px;
  margin-left: 6px;
  margin-right: 6px;
  letter-spacing: -1px;
  color: ${theme.palette.text.primary};
`) as typeof Typography


export const SBToggleBox = styled(Box)`
  width: 0px;
  height: 0px;
  z-index: 1300;
  position: relative;
`

export const SBToggleBtn = styled(IconButton)(({ theme }) => {
  return `
    position: absolute;
    transition: left 0.4s ease;
    top: ${(dims.header.height - 40)/2}px;
  `
})

export const NavList = styled(List)`
  padding: 0px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
`

export const NavItem = styled(ListItem)`
  width: 100%;
  opacity: 0.5;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  padding: ${gutter.tpx} ${gutter.tpx};
  transition: opacity 0.4s ease, color 0.4s ease, background-color 0.4s ease;

  &:hover {
    opacity: 1;
    background-color: ${cmx(colors.grey[500], 5)};
  }
  
  &.active {
    opacity: 1;
    color: ${colors.primary.main};
    background-color: ${cmx(colors.grey[500], 5)};
    & .MuiListItemIcon-root {
      color: ${colors.primary.main};
    }
    & .MuiTypography-root {
      color: ${colors.primary.main};
    }
  }

  &.open {
  
    & .MuiTypography-root {
      opacity: 1;
    }
    & .tdsk-list-item-expand {
      opacity: 1;
    }
  }
  
  
  & .MuiListItemIcon-root {
    padding-left: ${gutter.cpx};
    padding-right: ${gutter.hpx};
    transition: color 0.4s ease;
    
    & svg {
      font-size: 18px;
    }
  }
    
  & .MuiTypography-root {
    opacity: 0;
    font-size: 14px;
    transition: opacity 0.4s ease, color 0.4s ease;
  }
  
  & .tdsk-list-item-expand {
    opacity: 0;
    min-width: 0;
    transition: opacity 0.4s ease;
  }
`


export const SBNavListSpacer = styled(Box)`
  flex: 1;
`