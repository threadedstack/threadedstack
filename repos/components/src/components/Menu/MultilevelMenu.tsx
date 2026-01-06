import type { TMenuItem } from './MenuItems'
import type { ReactNode, MouseEvent, ComponentType, ComponentProps } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { stopEvent } from '@TSC/utils/helpers'
import { useState, useCallback, useEffect } from 'react'
import { MenuBack } from '@TSC/components/Menu/MenuBack'
import { useInline } from '@TSC/hooks/components/useInline'
import { MenuItems } from '@TSC/components/Menu/MenuItems'
import { MenuHeader } from '@TSC/components/Menu/MenuHeader'
import { MenuContext } from '@TSC/components/Menu/MenuContext'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import {
  MuiMenu,
  MenuBackText,
  MenuBackButton,
  MenuBackContainer,
} from '@TSC/components/Menu/Menu.styles'

export type TMultilevelMenu = Omit<ComponentProps<typeof MuiMenu>, `open` | `onClick`> & {
  open?: boolean
  title?: ReactNode
  stopEvent?: boolean
  autoClose?: boolean
  Context?: ReactNode
  children?: ReactNode
  items: TMenuItem[]
  headerClass?: string
  Header?: ComponentType<any>
  anchorEl?: HTMLElement | null | undefined
  HeaderIcon?: ReactNode | ComponentType<any>
  onOpen?: (event: MouseEvent<HTMLElement>) => any
  onClose?: (event: MouseEvent<HTMLElement>) => any
  onClick?: (item: TMenuItem, evt: MouseEvent<HTMLElement>) => any
}

const ext = {
  slot: {
    list: {
      sx: {
        padding: 0,
        width: `100%`,
        height: `100%`,
      },
    },
    paper: {
      sx: { overflow: `hidden` },
    },
  },
}

export const MultilevelMenu = (props: TMultilevelMenu) => {
  const {
    open,
    items,
    title,
    Context,
    onClick,
    children,
    anchorEl,
    className,
    HeaderIcon,
    elevation = 1,
    headerClass,
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

  const [crumbs, setCrumbs] = useState<string[]>([])
  const [history, setHistory] = useState<TMenuItem[][]>([items])
  const [currentItems, setCurrentItems] = useState<TMenuItem[]>(items)

  useEffect(() => {
    if (!open || history?.length) return

    setCurrentItems(items)
    setHistory([items])
  }, [open, items, history])

  const onBack = useCallback(() => {
    if (history.length <= 1) return

    const path = [...crumbs]
    path.pop()
    setCrumbs(path)

    const updated = [...history]
    updated.pop()
    setHistory(updated)

    setCurrentItems(updated[updated.length - 1])
  }, [history, currentItems])

  const onClose = useInline((evt) => {
    stopEvent(evt)
    onMenuClose?.(evt)

    const first = history[0] || items
    requestAnimationFrame(() => {
      setCrumbs([])
      setHistory([first])
      setCurrentItems(first)
    })
  })

  const onItemClick = useInline((item: TMenuItem, evt: MouseEvent<HTMLElement>) => {
    if (item?.items?.length) {
      setCrumbs((old) => [...old, item.label])
      setHistory((old) => [...old, item.items!])
      setCurrentItems(item.items)
    } else {
      autoClose && onClose?.(evt)
    }

    onClick?.(item, evt)
  })

  return (
    <MuiMenu
      {...rest}
      onClose={onClose}
      anchorEl={anchorEl}
      slotProps={ext.slot}
      elevation={elevation}
      autoFocus={autoFocus}
      keepMounted={keepMounted}
      open={Boolean(open && anchorEl)}
      disableEnforceFocus={disableEnforceFocus}
      className={cls(`tdsk-multilevel-slide-menu`, className)}
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

      {history.length > 1 && (
        <MenuBack
          crumbs={crumbs}
          onBack={onBack}
        />
      )}

      <MenuItems
        itemsReplace
        anchorEl={anchorEl}
        items={currentItems}
        onClick={onItemClick}
        elevation={elevation}
        autoClose={autoClose}
        onCloseMenu={onClose}
      />
    </MuiMenu>
  )
}
