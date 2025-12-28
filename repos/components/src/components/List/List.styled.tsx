import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MuiListSubheader from '@mui/material/ListSubheader'
import { styled } from '@mui/material/styles'

import { cmx, grey, gutter } from '@TSC/theme'

export const ListContainer = styled(Box)``

export const ListComp = styled(List)`
  padding: 0px;
  & > a.MuiTypography-root {
    box-sizing: border-box;
  }
  & > .tdsk-list-item-box > a.MuiTypography-root {
    box-sizing: border-box;
  }
`

export const ListSubHeader = styled(MuiListSubheader)`
  `

export const ListItemBox = styled(Box)`
  width: 100%;
  & .tdsk-list-container {
    padding-left: ${gutter.mpx};
  }
`

export const ItemContainer = styled(ListItemButton)(({ theme }) => {
  const bg = theme.palette.mode === `dark` ? grey[`700`] : grey[`100`]

  return `
    box-sizing: border-box;
    padding: ${gutter.qpx} ${gutter.tpx};

    &.Mui-selected,
    &.Mui-selected:hover {
      background-color: ${bg};
    }

    &:hover:not(.Mui-selected) {
      background-color: ${cmx(bg, 75)};
    }

    &.selected,
    &.selected:hover {
      background-color: ${bg};
    }
  `
})

export const ItemExpContainer = styled(Box)``

export const ItemText = styled(ListItemText)`
  margin: 2px 0px;
  & > span {
    font-size: 14px;
    line-height: 20px;
  }
`

export const ItemIcon = styled(ListItemIcon)`
  min-width: initial;
  padding-right: ${gutter.qpx};
`
