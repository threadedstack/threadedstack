import type { ReactNode } from 'react'
import type { Organization, Project, Agent } from '@tdsk/domain'
import type { TAnyCB } from '@TAF/types/helper.types'
import type {
  LinkProps,
  SvgIconProps,
  MenuItemProps,
  TypographyProps,
} from '@mui/material'

export type TNavCtx = {
  orgId?: string
  agentId?: string
  project?: Project
  projectId?: string
  org?: Organization
  agents?: Record<string, Agent>
}

export type TToAction = string | ((context: TNavCtx) => string)

export type TNavItem = {
  text: ReactNode
  Icon: ReactNode
  items?: TNavItem[]
  to?: TToAction
  visible?: (context: TNavCtx) => boolean
}

export type TNavSection = {
  id: string
  to?: TToAction
  items: TNavItem[]
  visible?: (context: TNavCtx) => boolean
  header?: string | ((context: TNavCtx) => string)
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
