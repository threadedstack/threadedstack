import type { TMenuItem } from './MenuItems'
import type {
  ReactNode,
  MouseEvent,
  ComponentType,
  ComponentProps,
  MutableRefObject,
} from 'react'

import { useMemo } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import { stopEvent } from '@TSC/utils/helpers'
import { exists } from '@keg-hub/jsutils/exists'
import { MuiMenu } from '@TSC/components/Menu/Menu.styles'
import { MenuItems } from '@TSC/components/Menu/MenuItems'
import { useInline } from '@TSC/hooks/components/useInline'
import { MenuHeader } from '@TSC/components/Menu/MenuHeader'
import { MenuContext } from '@TSC/components/Menu/MenuContext'

type TMenuPos = {
  anchorOrigin?: ComponentProps<typeof MuiMenu>[`anchorOrigin`]
  transformOrigin?: ComponentProps<typeof MuiMenu>[`transformOrigin`]
}

export type TMenu = Omit<ComponentProps<typeof MuiMenu>, `open` | `onClick`> & {
  open?: boolean
  title?: ReactNode
  stopEvent?: boolean
  autoClose?: boolean
  Context?: ReactNode
  children?: ReactNode
  items?: TMenuItem[]
  headerClass?: string
  Header?: ComponentType<any>
  anchorEl?: HTMLElement | null | undefined
  HeaderIcon?: ReactNode | ComponentType<any>
  onOpen?: (event: MouseEvent<HTMLElement>) => any
  onClose?: (event: MouseEvent<HTMLElement>) => any
  anchorRef?: MutableRefObject<HTMLElement | null | undefined>
  onClick?: (item: TMenuItem, evt: MouseEvent<HTMLElement>) => any
}

const usePos = (props: TMenu) => {
  const { anchorOrigin, transformOrigin } = props

  return useMemo(() => {
    const originProps = {
      anchorOrigin: {
        vertical: `bottom`,
        horizontal: `right`,
      },
      transformOrigin: {
        vertical: `top`,
        horizontal: `center`,
      },
    } as TMenuPos

    if (!anchorOrigin && !transformOrigin) return originProps

    if (anchorOrigin) originProps.anchorOrigin = anchorOrigin

    if (transformOrigin) originProps.transformOrigin = transformOrigin

    return originProps
  }, [anchorOrigin, transformOrigin])
}

export const Menu = (props: TMenu) => {
  const {
    open,
    items,
    title,
    Context,
    onClick,
    children,
    anchorEl,
    anchorRef,
    className,
    elevation = 1,
    headerClass,
    HeaderIcon,
    autoClose = true,
    autoFocus = false,
    keepMounted = true,
    Header = MenuHeader,
    onOpen: onMenuOpen,
    onClose: onMenuClose,
    stopEvent: stopEvt = true,
    disableEnforceFocus = true,
    ...rest
  } = props

  const pos = usePos(props)

  const onClose = useInline((evt) => {
    stopEvt && stopEvent(evt)
    onMenuClose?.(evt)
  })

  const hasRef = Boolean(anchorRef?.current || anchorEl)

  return (
    <MuiMenu
      {...rest}
      {...pos}
      onClose={onClose}
      elevation={elevation}
      autoFocus={autoFocus}
      keepMounted={keepMounted}
      disableEnforceFocus={disableEnforceFocus}
      className={cls(`tdsk-menu`, className)}
      anchorEl={anchorRef?.current || anchorEl}
      open={exists(open) ? Boolean(open && hasRef) : Boolean(anchorRef?.current)}
    >
      {((title || Header !== MenuHeader) && (
        <Header
          title={title}
          Icon={HeaderIcon}
          className={headerClass}
        />
      )) ||
        null}

      {(Context && <MenuContext>{Context}</MenuContext>) || null}

      {children}

      {items && (
        <MenuItems
          {...pos}
          Menu={Menu}
          items={items}
          onClick={onClick}
          elevation={elevation}
          autoClose={autoClose}
          onCloseMenu={onClose}
        />
      )}
    </MuiMenu>
  )
}
