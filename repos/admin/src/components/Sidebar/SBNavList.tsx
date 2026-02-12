import type { TNavItem, TNavCtx } from '@TAF/types'
import type { CSSProperties } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { stopEvent } from '@tdsk/components'
import { Link } from '@TAF/components/Link/Link'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { useNavigate, useLocation } from 'react-router'
import { NavItem, NavList } from '@TAF/components/Sidebar/Sidebar.styles'

export type TSBNavList = {
  open?: boolean
  items: TNavItem[]
  sx?: CSSProperties
  className?: string
  context?: TNavCtx
}

export type TSBNavItem = {
  open?: boolean
  item: TNavItem
  context?: TNavCtx
}

export const SBNavItem = (props: TNavItem & { open?: boolean; context?: TNavCtx }) => {
  const location = useLocation()
  const navigate = useNavigate()

  if (props.visible && !props.visible(props.context || {})) return null

  const resolvedPath = isFunc(props.to) ? props.to(props.context || {}) : props.to
  const hasChildren = Boolean(props.items?.length)

  // Parent items with children use prefix matching so they highlight when a child is active
  const isActive = hasChildren
    ? Boolean(resolvedPath && location.pathname.startsWith(resolvedPath))
    : location.pathname === resolvedPath

  return (
    <NavItem
      to={resolvedPath}
      key={resolvedPath}
      component={Link}
      Icon={props.Icon}
      text={props.text}
      items={props.items}
      defaultOpen={isActive}
      tooltip={!props.open ? { title: props.text, loc: `left` } : undefined}
      itemsListProps={{
        Item: SBNavItem,
        itemProps: { open: props.open, context: props.context },
      }}
      className={cls(props.open && `open`, isActive && `active`)}
      onClick={(evt: any) => {
        stopEvent(evt)
        if (resolvedPath) navigate(resolvedPath)
      }}
    />
  )
}

export const SBNavList = (props: TSBNavList) => {
  const { sx, open, items, className, context } = props

  return (
    <NavList
      sx={sx}
      items={items}
      Item={SBNavItem}
      itemProps={{ open, context }}
      className={cls(className, open && `open`)}
    />
  )
}
