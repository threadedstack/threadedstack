import {
  SidebarWidthOpen,
  DefaultCellWidth,
  DefaultCellHeight,
} from '@TTH/constants/values'

const HeaderHeight = 50
const TabBarHeight = 40
const SessionHeaderHeight = 48
const PagePadding = 64

export function estimateTerminalDimensions(): { cols: number; rows: number } {
  const availableWidth = window.innerWidth - SidebarWidthOpen - PagePadding
  const availableHeight =
    window.innerHeight - HeaderHeight - TabBarHeight - SessionHeaderHeight

  const cols = Math.max(80, Math.floor(availableWidth / DefaultCellWidth))
  const rows = Math.max(24, Math.floor(availableHeight / DefaultCellHeight))

  return { cols, rows }
}
