import type { TNavItem } from '@TAF/types'
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
}

export type TSBNavItem = {
  open?: boolean
  item: TNavItem
}

export const SBNavItem = (props: TNavItem & { open?: boolean }) => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <NavItem
      to={props.to}
      key={props.to}
      component={Link}
      Icon={props.Icon}
      text={props.text}
      items={props.items}
      tooltip={!props.open ? { title: props.text, loc: `left` } : undefined}
      className={cls(
        props.open && `open`,
        location.pathname.startsWith(props.to) && `active`
      )}
      onClick={(evt: any) => {
        stopEvent(evt)
        navigate(props.to)
      }}
    />
  )
}

export const SBNavList = (props: TSBNavList) => {
  const { sx, open, items, className } = props

  return (
    <NavList
      sx={sx}
      items={items}
      Item={SBNavItem}
      itemProps={{ open }}
      className={cls(className, open && `open`)}
    />
  )
}
