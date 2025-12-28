import type { ComponentProps, ReactNode, ComponentType, MouseEvent } from 'react'
import type { Menu } from './Menu'

import { useState } from 'react'
import { inherit } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils'
import { RenderType } from '../RenderType'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import { useInline } from '@TSC/hooks/components/useInline'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { StarCircleIcon } from '@TSC/components/Icons/StarCircleIcon'


import {
  LoadingIcon,
  MuiMenuItem,
  MenuItemsContainer,
  MenuItemIconContainer,
} from '@TSC/components/Menu/Menu.styles'

type TMShared = {
  className?:string
  elevation?:number
  autoClose?:boolean
  itemsReplace?:boolean
  anchorEl?:HTMLElement|null|undefined
  onCloseMenu?:(event: MouseEvent<HTMLElement>) => any
  onClick?:(item:TMenuItem, event: MouseEvent<HTMLElement>) => any
  anchorOrigin?:ComponentProps<typeof Menu>[`anchorOrigin`]
  transformOrigin?:ComponentProps<typeof Menu>[`transformOrigin`]
}


type TMItem = TMShared & {
  item:TMenuItem
  Menu?:typeof Menu
}

export type TMenuItem = TMShared & {
  id:string
  value?:any
  key?:string
  label?:string
  display?:string
  items?:TMenuItem[]
  children?:ReactNode
  iconProps?:ComponentProps<any>
  loadingProps?:ComponentProps<any>
  Icon?:ComponentType<any>|ReactNode
  EndIcon?:ComponentType<any>|ReactNode
  StartIcon?:ComponentType<any>|ReactNode
  loader?: (...args:any[]) => Promise<TMenuItem[]>
  [key:string]:any
}

export type TMenuItems = TMShared & {
  items: TMenuItem[]
  Menu?:typeof Menu
  ItemComponent?:ComponentType<TMenuItem>
}

export const MenuItem = (props:TMItem) => {
  const {
    Menu,
    item,
    onCloseMenu,
    itemsReplace,
  } = props

  const {
    Icon,
    label,
    items,
    EndIcon,
    children,
    disabled,
    anchorEl,
    iconProps,
    className,
    loadingProps,
    StartIcon=Icon,
  } = item


  const onClick = item.onClick ?? props.onClick
  const elevation = item.elevation ?? props.elevation
  const autoClose = item.autoClose || props.autoClose
  const anchorOrigin = item.anchorOrigin ?? props.anchorOrigin
  const transformOrigin = item.transformOrigin ?? props.transformOrigin

  const [open, setOpen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [localItems, setChildItems] = useState<TMenuItem[] | undefined>(undefined)

  const onMenuClose = useInline((evt:any) => {
    open && (items?.length || localItems?.length) && setOpen(false)
    onCloseMenu?.(evt)
  })


  const onItemClick = useInline(async (it:TMenuItem, evt:MouseEvent<HTMLElement>) => {
    /**
     * If the item that was clicked is the current item
     * Check if the child items should be loaded via the loader function
     * Else if items already loaded, ensure the child menu is open
     */
    if(it === item){

      if(it.loader && (!localItems && !loading || itemsReplace && !it?.items?.length)) {

        setLoading(true)
        const loaded = await it.loader()
        setLoading(false)

        if(itemsReplace) return onClick?.({ ...it, items: loaded }, evt)

        setOpen(true)
        setChildItems(loaded)
        
      }

      else if (items?.length || localItems?.length)
        !open && setOpen(true)

    }
    /**
     * If it's not the same item, assume it's a child item
     * And check if the clicked item has child items.
     * If not, then close the parent menu
     */
    else if(!it?.items?.length)
      open && autoClose && onMenuClose(evt)

    onClick?.(it, evt)
  })

  const isParent = Boolean(item.loader || item.items?.length)  
  const showMenu = !disabled && !itemsReplace && Menu && (items?.length || localItems?.length)
  const Icn = StartIcon ? StartIcon : (isParent ? ChevronRightIcon : <StarCircleIcon sx={{fontSize: `18px`}} />)

  return (
    <>
      <MuiMenuItem
        disabled={disabled}
        tooltip={item.tooltip}
        className={cls(`tdsk-menu-item`, className)}
        onClick={(evt) => onItemClick(item, evt)}
      >

        {Icn && (
          <MenuItemIconContainer className={cls(`tdsk-menu-item-icon`)}>
            <RenderType Component={Icn} props={iconProps} />
          </MenuItemIconContainer>
        ) || null}

        {label && (
          <ListItemText className='tdsk-menu-item-label'>
            {label}
          </ListItemText>
        ) || null}

        {!loading && EndIcon && (
          <ListItemIcon className='tdsk-menu-item-icon'>
            <RenderType Component={EndIcon} props={iconProps} />
          </ListItemIcon>
        ) || null}

        {loading && (
          <LoadingIcon
            size='1rem'
            {...loadingProps}
            sx={[inherit, loadingProps?.sx]}
          />
        ) || null}

        {children}
        
      </MuiMenuItem>
      {showMenu && (
        <Menu
          open={open}
          anchorEl={anchorEl}
          elevation={elevation}
          onClose={onMenuClose}
          autoClose={autoClose}
          onClick={onItemClick}
          anchorOrigin={anchorOrigin}
          items={localItems || items}
          transformOrigin={transformOrigin}
        />
      ) || null}
    </>
  )
}

export const MenuItems = (props:TMenuItems) => {

  const {
    Menu,
    items,
    onClick,
    anchorEl,
    className,
    elevation=1,
    onCloseMenu,
    anchorOrigin,
    itemsReplace,
    transformOrigin,
    autoClose=true,
    ItemComponent=MenuItem
  } = props

  return (
    <MenuItemsContainer className='tdsk-menu-items-container' >
      {
        items?.map((item) => {
          return (
            <ItemComponent
              item={item}
              Menu={Menu}
              id={item.id}
              onClick={onClick}
              anchorEl={anchorEl}
              elevation={elevation}
              className={className}
              onCloseMenu={onCloseMenu}
              anchorOrigin={anchorOrigin}
              itemsReplace={itemsReplace}
              transformOrigin={transformOrigin}
              key={item.key || item.id || item.text}
              autoClose={autoClose || item.autoClose}
            />
          )
        })
      }
    </MenuItemsContainer>
  )
}
