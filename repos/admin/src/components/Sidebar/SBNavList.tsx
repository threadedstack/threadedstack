import type { TNavItem, TNavContext } from '@TAF/types'
import type { CSSProperties } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { stopEvent } from '@tdsk/components'
import { Link } from '@TAF/components/Link/Link'
import { useNavigate, useLocation } from 'react-router'
import { NavItem, NavList } from '@TAF/components/Sidebar/Sidebar.styles'

export type TSBNavList = {
  open?: boolean
  items: TNavItem[]
  sx?: CSSProperties
  className?: string
  context?: TNavContext
}

export type TSBNavItem = {
  open?: boolean
  item: TNavItem
  context?: TNavContext
}

export const SBNavItem = (props: TNavItem & { open?: boolean; context?: TNavContext }) => {
  const location = useLocation()
  const navigate = useNavigate()

  // Check visibility with fallback for undefined context
  if (props.visible && !props.visible(props.context || {})) return null

  // Resolve dynamic path with fallback for undefined context
  const resolvedPath = typeof props.to === 'function' ? props.to(props.context || {}) : props.to

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
