import type { TListItemToggleRef } from '@TSC/types'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode, MouseEvent, ForwardedRef, ComponentType } from 'react'

import { List, TList } from './List'
import {
  ListItemBox,
  ItemContainer,
  ItemExpContainer,
  ItemIcon as ItemIconComp,
  ItemText as ItemTextComp,
} from './List.styled'

import { cls } from '@keg-hub/jsutils/cls'
import Collapse from '@mui/material/Collapse'
import ExpandMore from '@mui/icons-material/ExpandMore'
import ExpandLess from '@mui/icons-material/ExpandLess'
import { forwardRef, useEffect, useState } from 'react'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { TooltipHoc, type THocTooltip } from '@TSC/hocs/TooltipHoc'

export type TListItemMeta = Record<string, any>
export type TListItemIdType = string | number

export type TListItem<
  Meta extends TListItemMeta = TListItemMeta,
  ID extends TListItemIdType = TListItemIdType,
> = {
  id?: ID
  metadata?: Meta
  visible?: (...args: any[]) => boolean
  to?: ((...args: any[]) => void) | string
  text?: ReactNode
  divider?: boolean
  selected?: boolean
  sx?: SxProps<Theme>
  className?: string
  iconClass?: string
  textClass?: string
  disabled?: boolean
  children?: ReactNode
  key?: string | number
  items?: TListItem[]
  expandClass?: string
  defaultOpen?: boolean
  textSx?: SxProps<Theme>
  iconSx?: SxProps<Theme>
  expandOnClick?: boolean
  disableRipple?: boolean
  itemsSx?: SxProps<Theme>
  itemsClassName?: string
  expandSx?: SxProps<Theme>
  itemsSubheader?: ReactNode
  disableTouchRipple?: boolean
  itemsContainerClass?: string
  ItemIcon?: ComponentType<any>
  ItemText?: ComponentType<any>
  component?: ComponentType<any>
  itemsListProps?: Partial<TList>
  ItemExpand?: ComponentType<any>
  ChildList?: ComponentType<any>
  itemsContainerSx?: SxProps<Theme>
  onClick?: (...args: any[]) => void
  Icon?: ComponentType<any> | ReactNode
  itemsToggleRef?: TListItemToggleRef
}

export type TListItemPart = TListItem & {
  open?: boolean
  onOpen?: (...args: any[]) => void
}

export type TListItemExpand = TListItemPart & {}

const ItemText = (props: TListItemPart) => {
  const { text, open, textSx, selected, textClass } = props

  return (
    (text && (
      <ItemTextComp
        sx={textSx}
        primary={text}
        className={cls(
          textClass,
          `tdsk-list-item-text`,
          open && `tdsk-list-item-text-opened`,
          selected && `tdsk-list-item-text-selected`
        )}
      />
    )) ||
    null
  )
}

const ItemIcon = (props: TListItemPart) => {
  const { open, Icon, onOpen, iconSx, selected, iconClass } = props

  return (
    (Icon && (
      <ItemIconComp
        sx={iconSx}
        onClick={onOpen}
        className={cls(
          iconClass,
          `tdsk-list-item-icon-container`,
          open && `opened`,
          selected && `selected`
        )}
      >
        {isValidFuncComp(Icon) ? (
          <Icon
            id='tdsk-list-item-icon'
            className={cls(
              `tdsk-list-item-icon`,
              open && `opened`,
              selected && `selected`
            )}
          />
        ) : (
          Icon
        )}
      </ItemIconComp>
    )) ||
    null
  )
}

const ItemExpand = (props: TListItemExpand) => {
  const { id, open, onOpen, selected, expandSx, expandClass } = props

  return (
    <ItemExpContainer
      sx={expandSx}
      id={`${id}`}
      onClick={onOpen}
      className={cls(
        expandClass,
        `tdsk-list-item-expand`,
        open && `tdsk-list-item-expand-opened`,
        selected && `tdsk-list-item-expand-selected`
      )}
    >
      {open ? <ExpandLess /> : <ExpandMore />}
    </ItemExpContainer>
  )
}

const ItemNoChildren = TooltipHoc<TListItem, HTMLDivElement>(
  forwardRef((props: TListItem, ref: ForwardedRef<HTMLDivElement>) => {
    const {
      sx,
      id,
      text,
      Icon: _,
      divider,
      onClick,
      selected,
      children,
      component,
      className,
      defaultOpen,
      expandOnClick,
      itemsListProps,
      itemsToggleRef,
      ...rest
    } = props

    const Container = component ?? ItemContainer
    const Icon = props.ItemIcon ?? ItemIcon
    const Text = props.ItemText ?? ItemText

    return (
      <Container
        sx={sx}
        ref={ref}
        {...rest}
        id={`${id}`}
        divider={divider}
        onClick={onClick}
        selected={selected}
        className={cls(className, `tdsk-list-item`, selected && `selected`)}
      >
        {Icon && <Icon {...props} />}
        {text && Text && <Text {...props} />}
        {children}
      </Container>
    )
  })
)

const ItemWithChildren = TooltipHoc<TListItem, HTMLDivElement>(
  forwardRef((props: TListItem, ref: ForwardedRef<HTMLDivElement>) => {
    const {
      sx,
      id,
      items,
      Icon: _,
      onClick,
      itemsSx,
      divider,
      selected,
      metadata,
      disabled,
      className,
      component,
      defaultOpen,
      expandOnClick,
      itemsSubheader,
      itemsClassName,
      itemsToggleRef,
      itemsListProps,
      itemsContainerSx,
      itemsContainerClass,
      ...rest
    } = props

    const Container = component ?? ItemContainer
    const Icon = props.ItemIcon ?? ItemIcon
    const Text = props.ItemText ?? ItemText
    const Expand = props.ItemExpand ?? ItemExpand
    const ChildList = props.ChildList ?? List

    const [open, setOpen] = useState(defaultOpen ?? false)
    const onOpen = (evt: MouseEvent) => {
      evt?.preventDefault?.()
      evt?.stopPropagation?.()
      setOpen(!open)
    }

    const childOnClick = (evt: MouseEvent) => {
      evt?.preventDefault?.()
      evt?.stopPropagation?.()
      onOpen?.(evt)
    }

    const onClickCB = (evt: MouseEvent) => {
      expandOnClick && onOpen?.(evt)
      onClick?.(evt, open)
    }

    useEffect(() => {
      id && itemsToggleRef?.current && (itemsToggleRef.current[id] = { open, onOpen })
    }, [id, open])

    return (
      <ListItemBox className={cls(`tdsk-list-item-box`)}>
        <Container
          sx={sx}
          ref={ref}
          {...rest}
          divider={divider}
          onClick={onClickCB}
          selected={selected}
          disabled={disabled}
          className={cls(
            className,
            `tdsk-list-item`,
            open && `opened`,
            selected && `selected`
          )}
        >
          <Icon
            {...props}
            open={open}
            onOpen={childOnClick}
          />
          <Text
            {...props}
            open={open}
          />
          <Expand
            {...props}
            open={open}
            onOpen={childOnClick}
          />
        </Container>
        <Collapse
          in={open}
          timeout='auto'
          unmountOnExit
        >
          <ChildList
            disablePadding
            {...itemsListProps}
            sx={itemsSx}
            items={items}
            subheader={itemsSubheader}
            className={itemsClassName}
            containerSx={itemsContainerSx}
            containerClass={itemsContainerClass}
          />
        </Collapse>
      </ListItemBox>
    )
  })
)

export const ListItem = forwardRef(
  (
    props: TListItem & { tooltip?: THocTooltip | ReactNode },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    return props?.items?.length ? (
      <ItemWithChildren
        {...props}
        ref={ref}
      />
    ) : (
      <ItemNoChildren
        {...props}
        ref={ref}
      />
    )
  }
)

export {
  ItemIcon as ListItemIcon,
  ItemText as ListItemText,
  ItemExpand as ListItemExpand,
}
