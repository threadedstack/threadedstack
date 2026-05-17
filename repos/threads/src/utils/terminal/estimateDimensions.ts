import {
  SidebarWidthOpen,
  DefaultCellWidth,
  DefaultCellHeight,
} from '@TTH/constants/values'

import {
  PagePadding,
  HeaderHeight,
  TabBarHeight,
  ContentPadding,
  SessionHeaderHeight,
} from '@TTH/constants/terminal'

export function estimateTerminalDimensions(): { cols: number; rows: number } {
  const availableWidth = window.innerWidth - SidebarWidthOpen - PagePadding
  const availableHeight =
    window.innerHeight -
    HeaderHeight -
    TabBarHeight -
    SessionHeaderHeight -
    ContentPadding

  const cols = Math.max(80, Math.floor(availableWidth / DefaultCellWidth))
  const rows = Math.max(24, Math.floor(availableHeight / DefaultCellHeight))

  return { cols, rows }
}
