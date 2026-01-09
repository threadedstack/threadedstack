import type { ReactNode } from 'react'
import type { TListItem } from '@tdsk/components'
import type { TAnyCB } from '@TAF/types/helper.types'
import type {
  LinkProps,
  SvgIconProps,
  MenuItemProps,
  TypographyProps,
} from '@mui/material'

// Context for dynamic navigation
export type TNavContext = {
  teamId?: string
  teamName?: string
  repoId?: string
  repoName?: string
}

// Nav item with dynamic path support
export type TNavItem = {
  text: ReactNode
  Icon: ReactNode
  items?: TNavItem[]
  to?: string | ((context: TNavContext) => string)
  visible?: (context: TNavContext) => boolean
}

// Section in the sidebar
export type TNavSection = {
  id: string
  header?: string | ((context: TNavContext) => string)
  items: TNavItem[]
  visible?: (context: TNavContext) => boolean
}

// Full navigation configuration
export type TDynamicNavConfig = {
  sections: TNavSection[]
  bottomItems: TNavItem[]
}

export type TSettingNavItem = {
  id?: string
  Icon?: any
  path?: string
  label: string
  onClick?: TAnyCB
  divider?: boolean
  linkProps?: LinkProps
  iconProps?: SvgIconProps
  itemProps?: MenuItemProps
  textProps?: TypographyProps
}
