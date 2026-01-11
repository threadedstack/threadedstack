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

  return (
    <NavItem
      to={resolvedPath}
      key={resolvedPath}
      component={Link}
      Icon={props.Icon}
      text={props.text}
      items={props.items}
      tooltip={!props.open ? { title: props.text, loc: `left` } : undefined}
      className={cls(
        props.open && `open`,
        location.pathname === resolvedPath && `active`
      )}
      onClick={(evt: any) => {
        stopEvent(evt)
        navigate(resolvedPath)
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
