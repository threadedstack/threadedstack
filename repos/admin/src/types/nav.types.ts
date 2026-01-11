import type { ReactNode } from 'react'
import type { Team, Repo } from '@tdsk/domain'
import type { TAnyCB } from '@TAF/types/helper.types'
import type {
  LinkProps,
  SvgIconProps,
  MenuItemProps,
  TypographyProps,
} from '@mui/material'

export type TNavCtx = {
  team?: Team
  repo?: Repo
  teamId?: string
  repoId?: string
}

export type TNavItem = {
  text: ReactNode
  Icon: ReactNode
  items?: TNavItem[]
  to?: string | ((context: TNavCtx) => string)
  visible?: (context: TNavCtx) => boolean
}

export type TNavSection = {
  id: string
  header?: string | ((context: TNavCtx) => string)
  items: TNavItem[]
  visible?: (context: TNavCtx) => boolean
}

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
