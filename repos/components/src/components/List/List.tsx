import type { TListItemToggleRef } from '@TSC/types'
import type MuiList from '@mui/material/List'
import type { CSSProperties, ComponentProps, ComponentType, ReactNode } from 'react'
import type { TListItem } from './ListItem'

import { ListItem } from './ListItem'
import { cls } from '@keg-hub/jsutils/cls'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { ListComp, ListContainer, ListSubHeader } from './List.styled'

export type TList = Omit<ComponentProps<typeof MuiList>, `title`> & {
  title?: ReactNode
  sx?: CSSProperties
  className?: string
  items?: TListItem[]
  children?: ReactNode
  containerClass?: string
  Item?: ComponentType<any>
  List?: ComponentType<any>
  containerSx?: CSSProperties
  itemProps?: Record<string, any>
  Container?: ComponentType<any>
  Header?: ComponentType<any> | ReactNode
  itemsToggleRef?: TListItemToggleRef
}

export const List = (props: TList) => {
  const {
    sx,
    dense,
    items,
    title,
    children,
    className,
    itemProps,
    containerSx,
    containerClass,
    itemsToggleRef,
  } = props

  const Comp = props.List ?? ListComp
  const ItemComp = props.Item ?? ListItem
  const HeaderComp = props.Header ?? ListSubHeader
  const Container = props.Container ?? ListContainer

  return (
    <Container
      sx={containerSx}
      className={cls(containerClass, `tdsk-list-container`)}
    >
      <Comp
        sx={sx}
        dense={dense}
        aria-labelledby='tdsk-list-subheader'
        className={cls(className, `tdsk-list`)}
        subheader={
          (title || HeaderComp) &&
          (HeaderComp ? (
            isValidFuncComp(HeaderComp) ? (
              <HeaderComp id='tdsk-list-subheader'>{title}</HeaderComp>
            ) : (
              HeaderComp
            )
          ) : (
            title
          ))
        }
      >
        {items?.map((item, idx) => {
          return (
            <ItemComp
              {...item}
              {...itemProps}
              key={item?.key || idx}
              itemsToggleRef={itemsToggleRef}
            />
          )
        })}
        {children}
      </Comp>
    </Container>
  )
}
